// Loads the data files, validates every reference, and derives what the app draws.
// Add blocks, parts, edges, steps, sources or glossary terms in the JSON files; validate.js checks them.
import architecture from "./architecture.json";
import tasksFile from "./tasks.json";
import resourcesFile from "./resources.json";
import glossaryFile from "./glossary.json";
import siteFile from "./site.json";
import { validateAll } from "./validate.js";

validateAll({ architecture, tasks: tasksFile, resources: resourcesFile, glossary: glossaryFile, site: siteFile });

// Size a box to its label: wide enough for the text plus the (i) button, and two lines tall.
// Parts keep their fixed grid size; their labels truncate with a tooltip.
const CHAR_PX = 7.8;   // average width of 14px semibold text
const FIT_PAD = 64;    // room for the (i) button and padding on both sides
const MAX_W = 260;     // beyond this a label wraps onto a second line
const MIN_H = 46;      // two lines of 14px text

function fitBlock(b) {
  if (b.kind === "part" || b.kind === "core") return { w: b.w, h: b.h };
  const need = Math.ceil(b.label.length * CHAR_PX) + FIT_PAD;
  return { w: Math.max(b.w, Math.min(need, MAX_W)), h: Math.max(b.h, MIN_H) };
}

function derive(arch) {
  const NODES = {};
  for (const [id, b] of Object.entries(arch.blocks)) {
    const size = fitBlock(b);
    const src = b.info.source && resourcesFile.items.find((r) => r.id === b.info.source);
    const info = src ? { ...b.info, link: { title: src.title, url: src.url, publisher: src.publisher } } : b.info;
    NODES[id] = { t: b.label, k: b.kind, x: b.x, y: b.y, w: size.w, h: size.h, parts: b.parts, in: b.in, info, role: b.role };
  }
  const EDGES = arch.edges;
  const PARENT = Object.fromEntries(
    Object.entries(arch.blocks).filter(([, b]) => b.in).map(([id, b]) => [id, b.in])
  );
  return { NODES, EDGES, PARENT };
}

const { NODES, EDGES, PARENT } = derive(architecture);
const GROUPS = architecture.groups || [];

const TASKS = tasksFile.tasks.map((t) => ({
  name: t.name,
  desc: t.description,
  steps: t.steps.map((s) => ({ t: s.text, act: s.act, ann: s.annotations, fail: s.fail })),
}));

// further reading, grouped in the order the file lists them
const RESOURCES = resourcesFile.groups.map((g) => ({
  ...g,
  items: resourcesFile.items.filter((r) => r.group === g.id),
}));

const RESOURCE_BY_ID = Object.fromEntries(resourcesFile.items.map((r) => [r.id, r]));
const GLOSSARY = glossaryFile;
const SITE = siteFile;

export { NODES, EDGES, PARENT, TASKS, GROUPS, RESOURCES, RESOURCE_BY_ID, GLOSSARY, SITE };
