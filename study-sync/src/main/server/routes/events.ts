import { Router } from "express";
import { treeEvents } from "../tree";

const router = Router();

router.get("/events", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  treeEvents.addClient(res);
});

export default router;
