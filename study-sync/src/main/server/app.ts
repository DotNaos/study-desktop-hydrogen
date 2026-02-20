import cors from "cors";
import express from "express";
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
import vaultRouter from "./routes/vault";
import { swaggerDocument } from "./swagger";

export function createApp(): express.Express {
  const app = express();

  app.use(clerkAuthMiddleware);
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Swagger UI (disabled in production)
  if (process.env.NODE_ENV !== "production") {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  // Mount Routers
  app.use("/api", requireClerkAuth);
  app.use("/api", lazyReauthMiddleware);
  app.use("/api", healthRouter); // /api/health
  app.use("/api/auth", authRouter); // /api/auth/status
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

  return app;
}
