import { setSession } from "../main/services/studySyncService";
import { loadCliSession } from "./sessionStore";

export async function withStudySyncSession<T>(
  options: { autoSession?: boolean } = {},
  handler: () => Promise<T>,
): Promise<T> {
  const autoSession = options.autoSession !== false;
  if (autoSession) {
    const session = await loadCliSession();
    if (session) {
      try {
        await setSession({
          cookies: session.cookies,
          schoolId: session.schoolId,
          skipFetch: true,
        });
      } catch {
        // Ignore failures; commands will report auth errors if needed.
      }
    }
  }

  return handler();
}
