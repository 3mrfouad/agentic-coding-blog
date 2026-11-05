// After the build, copy the generated index.html to 404.html.
// On static hosts this makes unknown paths fall back to the app, so deep links and the
// hash router keep working. Runs via the "build" script.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const index = join(dist, "index.html");
if (!existsSync(index)) {
  console.error("post-build: dist/index.html not found; did the build run?");
  process.exit(1);
}
copyFileSync(index, join(dist, "404.html"));
console.log("post-build: wrote dist/404.html");
