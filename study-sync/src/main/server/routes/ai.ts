import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createLogger } from '@aryazos/ts-base/logging';
import { streamText, type CoreMessage } from "ai";
import { Router } from "express";
import { primaryProvider } from "../../providers";
import { remoteCache } from "../../remoteCache";
import { extractTextFromPdf, textCache } from "../services/textExtractor";

const logger = createLogger("com.aryazos.study-sync.server.ai");
const router = Router();

const SYSTEM_PROMPT = `You are a helpful study assistant. Use the provided context to answer the question.
If the context is insufficient, say what is missing and answer with best effort.
Keep responses concise and focused on the question.
Respond in the same language as the question.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  question: string;
  context?: string;
  nodeId?: string;
  history?: ChatMessage[];
}

function buildMessages(request: ChatRequest, modelName: string): CoreMessage[] {
  const messages: CoreMessage[] = [];
  const isGemma = modelName.toLowerCase().includes("gemma");

  // Build system content
  let systemContent = SYSTEM_PROMPT;
  if (request.context && request.context.trim().length > 0) {
    systemContent += `\n\nContext from PDF:\n${request.context}`;
  } else {
    systemContent += "\n\n(No PDF context provided.)";
  }

  // Gemma doesn't support system role - prepend to first user message
  if (!isGemma) {
    messages.push({ role: "system", content: systemContent });
  }

  // Add history
  if (request.history && request.history.length > 0) {
    for (const msg of request.history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add current question (with system prepended for Gemma)
  if (isGemma) {
    const userContent = `${systemContent}\n\n---\n\nUser question: ${request.question}`;
    messages.push({ role: "user", content: userContent });
  } else {
    messages.push({ role: "user", content: request.question });
  }

  return messages;
}

/**
 * POST /api/ai/chat
 * Streams AI response using Vercel AI SDK with Google Gemini.
 * Falls back to gemma-3-27b-it on rate limit.
 * Body: { question: string, context?: string, history?: ChatMessage[] }
 */
router.post("/chat", async (req, res) => {
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    logger.error("GOOGLE_API_KEY not configured");
    res.status(500).json({ error: "AI_NOT_CONFIGURED", message: "GOOGLE_API_KEY environment variable not set" });
    return;
  }

  let { question, context, history, nodeId } = req.body as ChatRequest;

  if (!question || question.trim().length === 0) {
    res.status(400).json({ error: "MISSING_QUESTION", message: "Question is required" });
    return;
  }

  // If nodeId is provided but no context, try to fetch text from the node
  if (nodeId && (!context || context.trim().length === 0)) {
    try {
      // Check cache first
      if (textCache.has(nodeId)) {
        const cached = textCache.get(nodeId)!;
        if (cached.method !== "empty") {
          context = cached.text;
          logger.info("Using cached PDF text for context", { nodeId, length: context.length });
        }
      } else {
        // Log attempt
        logger.info("Fetching PDF text for context", { nodeId });

        // Get PDF Data
        let pdfData: Buffer | undefined;

        if (remoteCache.hasFile(nodeId)) {
          pdfData = remoteCache.getFile(nodeId) ?? undefined;
        }

        if (!pdfData) {
          // Materialize/Download
          // Note: This relies on primaryProvider being authenticated if connecting to real backend
          // If using local/mock, it might proceed
          const node = await primaryProvider.materializeNode(nodeId);
          if (node) {
             if (remoteCache.hasFile(nodeId)) {
               pdfData = remoteCache.getFile(nodeId) ?? undefined;
             }
          }
        }

        if (pdfData) {
          const result = await extractTextFromPdf(pdfData);
          textCache.set(nodeId, result);
          if (result.method !== "empty") {
            context = result.text;
            logger.info("Extracted PDF text for context", { nodeId, length: context.length });
          } else {
             logger.warn("PDF extraction returned empty/ocr text", { nodeId });
          }
        } else {
           logger.warn("Could not load PDF data for context", { nodeId });
        }
      }
    } catch (err) {
      logger.error("Failed to fetch context from node", { error: err, nodeId });
      // Proceed without context (graceful degradation)
    }
  }

  const models = ["gemini-3-flash-preview", "gemma-3-27b-it"];

  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    const isLastModel = i === models.length - 1;
    const messages = buildMessages({ question, context, history }, modelName);

    try {
      const google = createGoogleGenerativeAI({ apiKey });

      logger.info("Starting AI chat stream", {
        model: modelName,
        questionLength: question.length,
        contextLength: context?.length ?? 0,
        historyLength: history?.length ?? 0
      });

      const result = streamText({
        model: google(modelName),
        messages,
      });

      // Collect chunks first before sending headers (so we can retry on empty stream)
      const chunks: string[] = [];
      const stream = result.textStream;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // If we got zero chunks, this model might be rate limited - try fallback
      if (chunks.length === 0 && !isLastModel) {
        logger.warn("Stream returned zero chunks, trying fallback model", { model: modelName });
        continue;
      }

      // We have content (or it's the last model) - send the response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Model-Used", modelName);

      // Send all collected chunks
      for (const chunk of chunks) {
        if (res.writableEnded) break;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      logger.info("Stream completed", { model: modelName, totalChunks: chunks.length, totalLength: chunks.join("").length });
      res.write("data: [DONE]\n\n");
      res.end();
      return; // Success, exit
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message?.toLowerCase() ?? "";
      const isRateLimit = errorMsg.includes("429") ||
                          errorMsg.includes("quota") ||
                          errorMsg.includes("too many requests") ||
                          errorMsg.includes("resource exhausted") ||
                          errorMsg.includes("rate limit");

      if (!isLastModel) {
        logger.warn(`Error on ${modelName}, trying fallback`, { model: modelName, error: error.message, isRateLimit });
        continue; // Try next model
      }

      logger.error("AI chat failed on all models", { error: error.message, model: modelName });

      if (isRateLimit) {
        res.status(429).json({ error: "RATE_LIMITED", message: "All AI models rate limited. Try again later." });
        return;
      }

      res.status(500).json({ error: "AI_FAILED", message: error.message || "AI request failed" });
      return;
    }
  }

  // If we get here, all models failed silently
  logger.error("All models exhausted without success", { lastError: lastError?.message });
  res.status(500).json({ error: "AI_FAILED", message: "All AI models failed to respond" });
});

/**
 * GET /api/ai/health
 * Check if AI is configured and ready.
 */
router.get("/health", (_req, res) => {
  const apiKey = process.env["GOOGLE_API_KEY"];
  res.json({
    configured: !!apiKey,
    provider: "google",
    models: ["gemini-3-flash-preview", "gemma-3-27b-it"],
    primary: "gemini-3-flash-preview",
    fallback: "gemma-3-27b-it"
  });
});

export default router;
