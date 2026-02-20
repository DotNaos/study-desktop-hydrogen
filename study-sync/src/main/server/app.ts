import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import { clerkAuthMiddleware, requireClerkAuth } from "./middleware/clerkAuth";
import { lazyReauthMiddleware } from "./middleware/lazyReauth";
import adminRouter from "./routes/admin";
import aiRouter from "./routes/ai";
import authRouter from "./routes/auth";
import calendarRouter from "./routes/calendar";
import downloaderRouter from "./routes/downloader";
import eventsRouter from "./routes/events";
import exportRouter from "./routes/export";
import exportTreeRouter from "./routes/exportTree";
import healthRouter from "./routes/health";
import mcpRouter from "./routes/mcp";
import nodesRouter from "./routes/nodes";
import remoteRouter from "./routes/remote";
import taskAttemptsRouter from "./routes/taskAttempts";
import vaultRouter from "./routes/vault";
import { swaggerDocument } from "./swagger";

export function createApp(): express.Express {
  const app = express();
  const rendererDistCandidates = [
    path.resolve(__dirname, "../renderer"),
    path.resolve(process.cwd(), "out/renderer"),
    path.resolve(__dirname, "../../renderer"),
  ];
  const rendererDistPath =
    rendererDistCandidates.find((candidate) => existsSync(candidate)) ??
    rendererDistCandidates[0];

  app.use(clerkAuthMiddleware);
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Swagger UI (disabled in production)
  if (process.env.NODE_ENV !== "production") {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  // Mount Routers
  app.use("/api", requireClerkAuth);
  app.use("/api", healthRouter); // /api/health
  app.use("/api/auth", authRouter); // /api/auth/status
  app.use("/api", lazyReauthMiddleware);
  app.use("/api/vault", vaultRouter); // /api/vault/*
  app.use("/api", nodesRouter); // /api/nodes/* and /api/moodle/courses
  app.use("/api", exportRouter); // /api/nodes/:id/export
  app.use("/api", exportTreeRouter); // /api/export/tree
  app.use("/api", calendarRouter); // /api/calendar/*
  app.use("/api", eventsRouter); // /api/events
  app.use("/api", adminRouter); // /api/admin/*
  app.use("/api", mcpRouter); // /api/mcp/*
  app.use("/api/export", downloaderRouter); // /api/export/*
  app.use("/api/remote", remoteRouter); // /api/remote/*
  app.use("/api/ai", aiRouter); // /api/ai/*
  app.use("/api", taskAttemptsRouter); // /api/task/:taskId/attempt

  if (existsSync(rendererDistPath)) {
    app.use(express.static(rendererDistPath));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(rendererDistPath, "index.html"));
    });
  }

  return app;
}
