import { createLogger } from '@aryazos/ts-base/logging';
import { exec, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = createLogger('com.aryazos.services.conversion');

/**
 * Extensions that can be converted to PDF via LibreOffice
 */
export const CONVERTIBLE_EXTENSIONS = [
    'pptx',
    'ppt',
    'docx',
    'doc',
    'xlsx',
    'xls',
    'odt',
    'ods',
    'odp',
];

/**
 * Extensions that are always included in exports (no conversion needed)
 */
export const ALWAYS_INCLUDED_EXTENSIONS = ['pdf'];

/**
 * Check if a file extension is convertible to PDF
 */
export function isConvertible(extension: string): boolean {
    const ext = extension.toLowerCase().replace(/^\./, '');
    return CONVERTIBLE_EXTENSIONS.includes(ext);
}

/**
 * Check if a file should be included in the default export (PDF or convertible)
 */
export function shouldIncludeByDefault(extension: string): boolean {
    const ext = extension.toLowerCase().replace(/^\./, '');
    return (
        ALWAYS_INCLUDED_EXTENSIONS.includes(ext) ||
        CONVERTIBLE_EXTENSIONS.includes(ext)
    );
}

export interface ConversionResult {
    success: boolean;
    pdfPath?: string;
    pdfBuffer?: Buffer;
    error?: string;
}

let libreOfficePathCache: string | null = null;
let libreOfficeChecked = false;

/**
 * Find the LibreOffice executable path
 */
function findLibreOfficePath(): string | null {
    if (libreOfficeChecked) {
        return libreOfficePathCache;
    }
    libreOfficeChecked = true;

    // Common paths for LibreOffice
    const possiblePaths = [
        // macOS
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
        // Linux
        '/usr/bin/soffice',
        '/usr/bin/libreoffice',
        '/usr/local/bin/soffice',
        // Try PATH
        'soffice',
    ];

    for (const path of possiblePaths) {
        try {
            if (path === 'soffice') {
                // Check if soffice is in PATH
                execSync('which soffice', { stdio: 'pipe' });
                libreOfficePathCache = 'soffice';
                return libreOfficePathCache;
            } else if (existsSync(path)) {
                libreOfficePathCache = path;
                return libreOfficePathCache;
            }
        } catch {
            // Continue to next path
        }
    }

    logger.warn(
        'LibreOffice not found. Install with: brew install --cask libreoffice (macOS) or apt install libreoffice (Linux)',
    );
    libreOfficePathCache = null;
    return null;
}

/**
 * Check if LibreOffice is available
 */
export function checkLibreOffice(): boolean {
    return findLibreOfficePath() !== null;
}

/**
 * Convert a file to PDF using LibreOffice
 *
 * @param inputPath - Path to the input file
 * @returns ConversionResult with the PDF buffer or error
 */
export async function convertToPdf(
    inputPath: string,
): Promise<ConversionResult> {
    const soffice = findLibreOfficePath();

    if (!soffice) {
        return {
            success: false,
            error: 'LibreOffice not installed. Install with: brew install --cask libreoffice',
        };
    }

    const ext = extname(inputPath).toLowerCase().replace(/^\./, '');
    if (!isConvertible(ext)) {
        return {
            success: false,
            error: `File type .${ext} is not convertible`,
        };
    }

    // Create a unique temp directory for this conversion
    const tempDir = join(
        tmpdir(),
        `soffice-convert-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tempDir, { recursive: true });

    try {
        const inputBasename = basename(inputPath, extname(inputPath));
        const expectedOutput = join(tempDir, `${inputBasename}.pdf`);

        // Run LibreOffice conversion
        // --headless: no GUI
        // --convert-to pdf: output format
        // --outdir: output directory
        const cmd = `"${soffice}" --headless --convert-to pdf --outdir "${tempDir}" "${inputPath}"`;

        logger.debug('Running LibreOffice conversion', { cmd });

        try {
            await execAsync(cmd, { timeout: 60000 }); // 60 second timeout
        } catch (err) {
            const error = err as Error & { stderr?: string };
            logger.error('LibreOffice conversion failed', {
                error: error.message,
                stderr: error.stderr,
            });
            return {
                success: false,
                error: `Conversion failed: ${error.message}`,
            };
        }

        // Check if output was created
        if (!existsSync(expectedOutput)) {
            logger.error('LibreOffice did not produce output', {
                expectedOutput,
            });
            return {
                success: false,
                error: 'Conversion produced no output',
            };
        }

        // Read the PDF
        const pdfBuffer = readFileSync(expectedOutput);

        logger.info('Successfully converted to PDF', {
            input: basename(inputPath),
            outputSize: pdfBuffer.length,
        });

        return {
            success: true,
            pdfPath: expectedOutput,
            pdfBuffer,
        };
    } finally {
        // Cleanup temp directory
        try {
            rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Convert a buffer to PDF
 * Writes the buffer to a temp file, converts, and returns the PDF buffer
 */
export async function convertBufferToPdf(
    buffer: Buffer,
    filename: string,
): Promise<ConversionResult> {
    const ext = extname(filename).toLowerCase().replace(/^\./, '');

    if (!isConvertible(ext)) {
        return {
            success: false,
            error: `File type .${ext} is not convertible`,
        };
    }

    // Write to temp file
    const tempDir = join(tmpdir(), `convert-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const tempPath = join(tempDir, filename);

    try {
        writeFileSync(tempPath, buffer);
        return await convertToPdf(tempPath);
    } finally {
        try {
            rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Normalize a filename to handle encoding issues
 * Converts various Unicode representations to NFC form
 */
export function normalizeFilename(filename: string): string {
    // Normalize to NFC (canonical decomposition followed by canonical composition)
    // This handles cases like "ü" being represented as "u" + combining diaeresis
    return filename.normalize('NFC');
}
