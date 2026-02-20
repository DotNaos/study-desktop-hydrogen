import { Router } from "express";
import { primaryProvider } from "../../providers";
import { remoteCache } from "../../remoteCache";

const router = Router();

router.get("/health", (_req, res) => {
  const stats = remoteCache.getStats();
  res.json({
    status: "ok",
    timestamp: Date.now(),
    authenticated: primaryProvider.isAuthenticated(),
    cache: stats,
  });
});

export default router;
