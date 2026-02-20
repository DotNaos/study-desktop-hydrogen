import { Router } from "express";
import { fetchCalendarFeedText } from "../calendar/feed";
import { extractCalendarCourses } from "../calendar/ics";
import { treeService } from "../tree";
import { normalizeName } from "../tree/normalize";

const router = Router();

const tools = [
  { name: "tree_root", description: "List root nodes" },
  { name: "tree_children", description: "List children for a node" },
  { name: "tree_search", description: "Search nodes" },
  { name: "tree_refresh_partition", description: "Force refresh a partition root" },
  { name: "calendar_suggestions", description: "List calendar courses and node suggestions" },
  { name: "calendar_put_match", description: "Persist calendar name mapping" },
  { name: "calendar_get_match", description: "Fetch a calendar mapping" },
];

router.get("/mcp/tools", (_req, res) => {
  res.json({ tools });
});

router.post("/mcp", async (req, res) => {
  try {
    const tool = String(req.body?.tool || "").trim();
    const args = req.body?.args || {};

    switch (tool) {
      case "tree_root": {
        await treeService.ensureBuilt();
        const nodes = await treeService.store.getRootNodes();
        res.json({ result: nodes });
        return;
      }
      case "tree_children": {
        await treeService.ensureBuilt();
        const nodeId = String(args.node_id || "").trim();
        if (!nodeId) {
          res.status(400).json({ error: "NODE_ID_REQUIRED" });
          return;
        }
        const nodes = await treeService.store.getChildren(nodeId);
        res.json({ result: nodes });
        return;
      }
      case "tree_search": {
        await treeService.ensureBuilt();
        const query = String(args.query || "");
        const limit = Math.min(Math.max(Number(args.limit || 20), 1), 100);
        const results = await treeService.store.search(query, limit);
        res.json({ result: results });
        return;
      }
      case "tree_refresh_partition": {
        await treeService.ensureBuilt();
        const partitionRootId = String(args.partition_root_id || "").trim();
        if (!partitionRootId) {
          res.status(400).json({ error: "PARTITION_ROOT_ID_REQUIRED" });
          return;
        }
        const result = await treeService.refreshPartition(partitionRootId, { force: true });
        res.json({ result });
        return;
      }
      case "calendar_suggestions": {
        const limit = Math.min(Math.max(Number(args.k || 3), 1), 10);
        const maxItems = Math.min(Math.max(Number(args.max_items || 25), 1), 100);
        const hasNodes = await treeService.store.hasAnyNodes();
        if (!hasNodes) {
          res.json({
            result: {
              calendar_items: [],
              suggestions: [],
              matches: [],
              error: "TREE_CACHE_EMPTY",
            },
          });
          return;
        }
        const feed = await fetchCalendarFeedText();
        if (!feed.ok) {
          res.json({
            result: {
              calendar_items: [],
              suggestions: [],
              matches: [],
              error: feed.error,
            },
          });
          return;
        }

        const courses = extractCalendarCourses(feed.text, maxItems);
        const suggestions = [];
        const matches = [];

        for (const course of courses) {
          const results = await treeService.store.search(course.name_raw, limit);
          suggestions.push({
            calendar: course,
            suggestions: results,
          });

          const match = await treeService.store.getCalendarMatch(course.name_norm);
          const node = match ? await treeService.store.getNode(match.node_id) : null;
          matches.push({
            calendar: course,
            match,
            node,
          });
        }

        res.json({
          result: {
            calendar_items: courses,
            suggestions,
            matches,
          },
        });
        return;
      }
      case "calendar_put_match": {
        const name = String(args.name || "");
        const nodeId = String(args.node_id || "");
        const nameNorm = normalizeName(name);
        if (!nameNorm || !nodeId) {
          res.status(400).json({ error: "NAME_AND_NODE_REQUIRED" });
          return;
        }
        await treeService.store.upsertCalendarMatch({
          calendar_name_norm: nameNorm,
          calendar_name_raw: name,
          node_id: nodeId,
          updated_at: Date.now(),
        });
        res.json({ result: { ok: true } });
        return;
      }
      case "calendar_get_match": {
        const name = String(args.name || "");
        const nameNorm = normalizeName(name);
        if (!nameNorm) {
          res.status(400).json({ error: "NAME_REQUIRED" });
          return;
        }
        const match = await treeService.store.getCalendarMatch(nameNorm);
        res.json({ result: match });
        return;
      }
      default:
        res.status(400).json({ error: "UNKNOWN_TOOL" });
    }
  } catch (error) {
    res.status(500).json({ error: "MCP_FAILED" });
  }
});

export default router;
