// Post-build: stamp the service worker cache name with the current git SHA
// (or a timestamp fallback) so every deploy activates a fresh SW that purges
// previous-release caches. Without this, `public/sw.js` is byte-identical
// across releases, the browser never updates it, and a stale cached app shell
// can load against new hashed chunks after a deploy.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.join(root, "..", "dist", "sw.js");

let buildId = `2.3.0-${Date.now().toString(36)}`;

try {
  const src = readFileSync(swPath, "utf8");
  if (!src.includes("__BUILD_ID__")) {
    console.log("[stamp-sw] dist/sw.js already stamped, skipping");
    process.exit(0);
  }
  writeFileSync(swPath, src.replaceAll("__BUILD_ID__", buildId));
  console.log(`[stamp-sw] stamped dist/sw.js cache as pulse-cache-${buildId}`);
} catch (err) {
  console.warn("[stamp-sw] skipping:", err?.message || err);
}
