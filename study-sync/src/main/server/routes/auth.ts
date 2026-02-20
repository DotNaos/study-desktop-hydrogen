import { Router } from "express";
import { setMoodleCookies } from "../../moodle";
import { primaryProvider } from "../../providers";
import { ProviderErrorCodes } from "../../types";

const router = Router();

router.get("/status", (_req, res) => {
  const authenticated = primaryProvider.isAuthenticated();
  res.json({
    authenticated,
    error: authenticated ? null : ProviderErrorCodes.AUTH_REQUIRED,
  });
});

router.post("/login", async (_req, res) => {
  try {
    const authModule = await import("../../authentication");
    await authModule.performAutoLogin();
    res.json({ ok: true });
  } catch (error) {
    res.status(501).json({ error: "LOGIN_UNAVAILABLE" });
  }
});

router.post("/session", async (req, res) => {
  try {
    const cookies = String((req.body as any)?.cookies || "");
    const schoolId = (req.body as any)?.schoolId as string | undefined;
    const skipFetch = Boolean((req.body as any)?.skipFetch);

    if (!cookies.trim()) {
      res.status(400).json({ error: "COOKIES_REQUIRED" });
      return;
    }

    await setMoodleCookies(cookies, schoolId, { skipFetch });
    res.json({ ok: true, authenticated: primaryProvider.isAuthenticated() });
  } catch (error) {
    res.status(500).json({ error: "SESSION_FAILED" });
  }
});

export default router;
