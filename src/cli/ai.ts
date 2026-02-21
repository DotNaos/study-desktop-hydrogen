import type {
    CliCommand,
    CliContext,
    CliFlagValue,
} from '@aryazos/ts-base/cli';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { primaryProvider } from '../main/providers';
import { remoteCache } from '../main/remoteCache';
import { extractTextFromPdf } from '../main/server/services/textExtractor';
import { parseNodePath, PathResolutionError, resolveNodeByPath } from './paths';
import { withStudySyncSession } from './runtime';

function getStringFlag(
    flags: Record<string, CliFlagValue>,
    name: string,
    alias?: string,
): string | undefined {
    const value = flags[name] ?? (alias ? flags[alias] : undefined);
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }
    return undefined;
}

function isJson(flags: Record<string, CliFlagValue>): boolean {
    return Boolean(flags['json'] ?? flags['j']);
}

const SYSTEM_PROMPT = `You are a helpful study assistant. Use the provided context to answer the question.
If the context is insufficient, say what is missing and answer with best effort.
Keep responses concise and focused on the question.
Respond in the same language as the question.`;

async function runText(ctx: CliContext): Promise<void> {
    const pathArg = ctx.args[0];
    if (!pathArg) {
        ctx.stderr(
            'Missing path. Example: aryazos study ai text "Course/Lecture.pdf"',
        );
        ctx.exit(1);
    }

    const segments = parseNodePath(pathArg);
    if (segments.length === 0) {
        ctx.stderr('Path must include at least one segment.');
        ctx.exit(1);
    }

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const result = await resolveNodeByPath(segments);
            const nodeId = result.node.id;

            let pdfData: Buffer | undefined;

            if (remoteCache.hasFile(nodeId)) {
                pdfData = remoteCache.getFile(nodeId) ?? undefined;
            }

            if (!pdfData) {
                ctx.stdout('Downloading file...');
                const node = await primaryProvider.materializeNode(nodeId);
                if (node === null) {
                    ctx.stderr(
                        'This resource is a page, not a downloadable file.',
                    );
                    ctx.exit(1);
                }
                if (remoteCache.hasFile(nodeId)) {
                    pdfData = remoteCache.getFile(nodeId) ?? undefined;
                }
            }

            if (!pdfData) {
                ctx.stderr('Failed to download file.');
                ctx.exit(1);
            }

            const extraction = await extractTextFromPdf(pdfData);

            if (isJson(ctx.flags)) {
                ctx.stdout(
                    JSON.stringify(
                        {
                            pages: extraction.pages,
                            method: extraction.method,
                            textLength: extraction.text.length,
                            text: extraction.text,
                        },
                        null,
                        2,
                    ),
                );
                return;
            }

            ctx.stdout(`Pages: ${extraction.pages}`);
            ctx.stdout(`Method: ${extraction.method}`);
            ctx.stdout(`Text length: ${extraction.text.length} characters`);
            ctx.stdout('---');
            ctx.stdout(extraction.text.slice(0, 2000));
            if (extraction.text.length > 2000) {
                ctx.stdout(
                    `... (truncated ${extraction.text.length - 2000} more characters)`,
                );
            }
        });
    } catch (error) {
        if (error instanceof PathResolutionError) {
            ctx.stderr(`Path error: ${error.message}`);
        } else if (error instanceof Error) {
            ctx.stderr(error.message);
        } else {
            ctx.stderr('Unexpected error.');
        }
        ctx.exit(1);
    }
}

async function runChat(ctx: CliContext): Promise<void> {
    const question = ctx.args[0];
    const contextPath = getStringFlag(ctx.flags, 'context', 'c');

    if (!question) {
        ctx.stderr(
            'Missing question. Example: aryazos study ai chat "Explain exercise 1" --context "Course/Lecture.pdf"',
        );
        ctx.exit(1);
    }

    const apiKey = process.env['GOOGLE_API_KEY'];
    if (!apiKey) {
        ctx.stderr(
            'GOOGLE_API_KEY not set. Source your ~/.env or export it directly.',
        );
        ctx.exit(1);
    }

    let context = '';

    if (contextPath) {
        try {
            await withStudySyncSession({ autoSession: true }, async () => {
                const segments = parseNodePath(contextPath);
                const result = await resolveNodeByPath(segments);
                const nodeId = result.node.id;

                let pdfData: Buffer | undefined;
                if (remoteCache.hasFile(nodeId)) {
                    pdfData = remoteCache.getFile(nodeId) ?? undefined;
                }

                if (!pdfData) {
                    ctx.stdout('Downloading PDF for context...');
                    const node = await primaryProvider.materializeNode(nodeId);
                    if (node === null) {
                        ctx.stderr('Context file is not downloadable.');
                        ctx.exit(1);
                    }
                    if (remoteCache.hasFile(nodeId)) {
                        pdfData = remoteCache.getFile(nodeId) ?? undefined;
                    }
                }

                if (pdfData) {
                    const extraction = await extractTextFromPdf(pdfData);
                    context = extraction.text;
                    ctx.stdout(
                        `Extracted ${extraction.text.length} characters from PDF (${extraction.method})`,
                    );
                }
            });
        } catch (error) {
            ctx.stderr(
                `Failed to extract context: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            ctx.exit(1);
        }
    }

    // Build prompt with context
    let prompt = SYSTEM_PROMPT;
    if (context.length > 0) {
        prompt += `\n\nContext from PDF:\n${context.slice(0, 30000)}`;
    }
    prompt += `\n\nUser question: ${question}`;

    const models = ['gemini-3-flash-preview', 'gemma-3-27b-it'];

    for (const modelName of models) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: modelName });

            ctx.stdout(`Connecting to ${modelName}...`);
            ctx.stdout('---');

            const result = await model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                const text = chunk.text();
                process.stdout.write(text);
            }

            ctx.stdout('\n---');
            return; // Success, exit function
        } catch (error: any) {
            const isRateLimit =
                error.message?.includes('429') ||
                error.message?.includes('quota') ||
                error.message?.includes('Too Many Requests');

            if (isRateLimit && modelName !== models[models.length - 1]) {
                ctx.stderr(`\nRate limit on ${modelName}, trying fallback...`);
                continue; // Try next model
            }

            ctx.stderr(`AI error: ${error.message || error}`);
            if (isRateLimit) {
                ctx.stderr(
                    'All models rate limited. Please wait and try again.',
                );
            }
            ctx.exit(1);
        }
    }
}

export function createAiCommand(): CliCommand {
    const baseOptions = [
        { name: 'json', alias: 'j', description: 'Output JSON' },
    ];

    return {
        name: 'ai',
        description: 'AI tools for PDFs and study content',
        run: (ctx) => ctx.showHelp(),
        subcommands: [
            {
                name: 'text',
                description: 'Extract text from a PDF',
                args: '<path>',
                options: baseOptions,
                run: runText,
            },
            {
                name: 'chat',
                description: 'Ask AI a question with optional PDF context',
                args: '<question>',
                options: [
                    ...baseOptions,
                    {
                        name: 'context',
                        alias: 'c',
                        description: 'Path to PDF for context',
                    },
                ],
                run: runChat,
            },
        ],
    };
}
