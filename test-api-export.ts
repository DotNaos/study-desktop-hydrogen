
import { loadCliSession } from "./src/cli/sessionStore";

async function main() {
  const session = await loadCliSession();
  if (!session) {
    console.error("No active session found. Please run 'aryazos study sync login' first.");
    process.exit(1);
  }

  const port = process.env.ARYAZOS_STUDY_SYNC_PORT || 3335;
  // Use FS25 term ID
  const nodeId = "moodle-term-FS25";
  const url = `http://localhost:${port}/api/nodes/${nodeId}/export?includeFiles=true&maxFiles=5`;

  console.log(`Fetching ${url}...`);
  try {
      const res = await fetch(url, {
        headers: {
            "Cookie": session.cookies
        }
      });

      if (!res.ok) {
        console.error("API Error:", res.status, res.statusText);
        const text = await res.text();
        console.error(text);
        process.exit(1);
      }

      const blob = await res.blob();
      console.log("Success! Received ZIP size:", blob.size);

      if (blob.size < 100) {
          console.warn("Warning: ZIP size is suspiciously small.");
      }
  } catch (err) {
      console.error("Fetch failed:", err);
      process.exit(1);
  }
}

main();
