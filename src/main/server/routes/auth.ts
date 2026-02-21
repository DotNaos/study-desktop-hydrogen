import { Router } from "express";
import { setMoodleCookies } from "../../moodle";
import { primaryProvider } from "../../providers";
import { authenticateMoodleCredentials, bootstrapMoodleAuth } from "../../startupAuth";
import { ProviderErrorCodes } from "../../types";
import { store } from "../../config";

const router = Router();

router.get("/status", (_req, res) => {
    const authenticated = primaryProvider.isAuthenticated();
    const selectedSchool = store.get("selectedSchool") ?? null;
    const hasStoredCredentials = Boolean(
      selectedSchool &&
        store.get(`schools.${selectedSchool}.username`) &&
        store.get(`schools.${selectedSchool}.password`)
    );

    res.json({
        authenticated,
        error: authenticated ? null : ProviderErrorCodes.AUTH_REQUIRED,
        selectedSchool,
        hasStoredCredentials,
    });
});

router.post("/login", async (req, res) => {
  try {
    const username = String((req.body as any)?.username || "").trim();
    const password = String((req.body as any)?.password || "").trim();
    const schoolId = String((req.body as any)?.schoolId || "").trim();

    if (username && password) {
      const result = await authenticateMoodleCredentials({
        username,
        password,
        schoolId: schoolId || undefined,
      });
      res.json({
        ok: true,
        authenticated: primaryProvider.isAuthenticated(),
        schoolId: result.schoolId,
      });
      return;
    }

    const ok = await bootstrapMoodleAuth();
    if (!ok || !primaryProvider.isAuthenticated()) {
      res.status(401).json({ error: "LOGIN_FAILED" });
      return;
    }
    res.json({ ok: true, authenticated: true });
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "LOGIN_FAILED";
    if (code === "USERNAME_PASSWORD_REQUIRED") {
      res.status(400).json({ error: code });
      return;
    }
    res.status(401).json({ error: "LOGIN_FAILED" });
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
