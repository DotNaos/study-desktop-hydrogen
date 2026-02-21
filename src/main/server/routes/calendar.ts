import { Router } from "express";
import { fetchCalendarFeedText } from "../calendar/feed";
import { normalizeName } from "../tree/normalize";
import { treeService } from "../tree";

const router = Router();

router.get("/calendar/feed", async (_req, res) => {
  const result = await fetchCalendarFeedText();
  if (!result.ok) {
    if (result.error === "CALENDAR_URL_NOT_CONFIGURED") {
      res.status(404).json({ error: result.error });
      return;
    }
    if (result.error === "CALENDAR_URL_INVALID") {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(502).json({ error: result.error });
    return;
  }

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.status(200).send(result.text);
});

router.get("/calendar/suggestions", async (req, res) => {
  try {
    const rawName = String(req.query?.name || "").trim();
    if (!rawName) {
      res.status(400).json({ error: "NAME_REQUIRED" });
      return;
    }
    const hasNodes = await treeService.store.hasAnyNodes();
    if (!hasNodes) {
      res.status(503).json({ error: "TREE_CACHE_EMPTY" });
      return;
    }

    const limit = Math.min(Math.max(Number(req.query?.k || 3), 1), 10);
    const results = await treeService.store.search(rawName, limit);
    res.json({ name: rawName, suggestions: results });
  } catch (error) {
    res.status(500).json({ error: "SUGGESTIONS_FAILED" });
  }
});

router.get("/calendar/matches", async (_req, res) => {
  try {
    const matches = await treeService.store.listCalendarMatches();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: "MATCHES_FAILED" });
  }
});

router.get("/calendar/matches/:name", async (req, res) => {
  try {
    const nameNorm = normalizeName(req.params.name || "");
    if (!nameNorm) {
      res.status(400).json({ error: "NAME_REQUIRED" });
      return;
    }
    const match = await treeService.store.getCalendarMatch(nameNorm);
    if (!match) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: "MATCH_FETCH_FAILED" });
  }
});

router.put("/calendar/matches/:name", async (req, res) => {
  try {
    const rawName = String(req.body?.calendar_name_raw || req.params.name || "");
    const nameNorm = normalizeName(req.params.name || rawName);
    const nodeId = String(req.body?.node_id || "").trim();

    if (!nameNorm || !nodeId) {
      res.status(400).json({ error: "NAME_AND_NODE_REQUIRED" });
      return;
    }

    await treeService.store.upsertCalendarMatch({
      calendar_name_norm: nameNorm,
      calendar_name_raw: rawName,
      node_id: nodeId,
      updated_at: Date.now(),
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "MATCH_SAVE_FAILED" });
  }
});

router.delete("/calendar/matches/:name", async (req, res) => {
  try {
    const nameNorm = normalizeName(req.params.name || "");
    if (!nameNorm) {
      res.status(400).json({ error: "NAME_REQUIRED" });
      return;
    }
    await treeService.store.deleteCalendarMatch(nameNorm);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "MATCH_DELETE_FAILED" });
  }
});

export default router;
