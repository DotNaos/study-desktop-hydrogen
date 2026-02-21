import { Router } from "express";
import { requireAdmin } from "../middleware/clerkAuth";
import { getAllUsers, getUserByExternalId, setUserEnabled } from "../auth/userDb";
import { treeService } from "../tree";

const router = Router();

router.use(requireAdmin);

router.post("/admin/reset", async (_req, res) => {
  try {
    await treeService.store.reset();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "RESET_FAILED" });
  }
});

router.post("/admin/rebuild", async (_req, res) => {
  try {
    await treeService.fullRebuild();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "REBUILD_FAILED" });
  }
});

router.get("/admin/users", async (_req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "USER_LIST_FAILED" });
  }
});

router.get("/admin/users/:id", async (req, res) => {
  try {
    const user = await getUserByExternalId(req.params.id);
    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "USER_LOOKUP_FAILED" });
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  const { enabled } = req.body ?? {};
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "INVALID_BODY" });
    return;
  }

  try {
    const user = await setUserEnabled(req.params.id, enabled);
    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "USER_UPDATE_FAILED" });
  }
});

export default router;
