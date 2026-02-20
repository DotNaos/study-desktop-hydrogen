import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { swaggerDocument } from "../src/main/server/swagger";

const outputPath = resolve(process.cwd(), "openapi.json");

async function main(): Promise<void> {
  await writeFile(outputPath, JSON.stringify(swaggerDocument, null, 2), "utf-8");
  console.log(`[openapi] wrote ${outputPath}`);
}

main().catch((error) => {
  console.error("[openapi] export failed", error);
  process.exit(1);
});
