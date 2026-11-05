// Validates every data file without starting the app: `npm run check`.
// Exits with an error message pointing at the first problem it finds.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateAll } from "../src/data/validate.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const load = (name) => JSON.parse(readFileSync(join(dir, name), "utf8"));

try {
  validateAll({
    architecture: load("architecture.json"),
    tasks: load("tasks.json"),
    resources: load("resources.json"),
    glossary: load("glossary.json"),
    site: load("site.json"),
  });
  const a = load("architecture.json");
  const t = load("tasks.json");
  const steps = t.tasks.reduce((n, x) => n + x.steps.length, 0);
  console.log(`data OK: ${Object.keys(a.blocks).length} blocks, ${a.edges.length} lines, ${t.tasks.length} scenarios, ${steps} steps`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
