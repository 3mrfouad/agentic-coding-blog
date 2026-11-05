// Validates the data files. Pure: it takes the parsed files and throws on the first problem.
// Used by the app at load time and by `npm run check` (scripts/check-data.mjs).

const KINDS = new Set(["block", "gate", "ext", "core", "part"]);

function fail(msg) {
  throw new Error(`[architecture data] ${msg}`);
}

function validateResources(res, resourceIds) {
  const groupIds = new Set(res.groups.map((g) => g.id));
  res.items.forEach((r) => {
    if (resourceIds.has(r.id)) fail(`resource id "${r.id}" is used twice`);
    resourceIds.add(r.id);
    if (!r.title || !r.publisher || !r.about) fail(`resource "${r.id}" needs title, publisher and about`);
    if (!String(r.url).startsWith("https://")) fail(`resource "${r.id}" url must be https`);
    if (!groupIds.has(r.group)) fail(`resource "${r.id}" has unknown group "${r.group}"`);
  });
}

function validateArchitecture(arch, tasks, resourceIds) {
  const blocks = arch.blocks;
  const ids = new Set(Object.keys(blocks));

  for (const [id, b] of Object.entries(blocks)) {
    if (!KINDS.has(b.kind)) fail(`"${id}" has unknown kind "${b.kind}"`);
    if (!b.label) fail(`"${id}" has no label`);
    if (b.kind === "part") {
      if (!b.in || !blocks[b.in]) fail(`part "${id}" must reference an existing block in "in"`);
      if (!(blocks[b.in].parts || []).includes(id))
        fail(`part "${id}" is not listed in the parts of "${b.in}"`);
    } else {
      if (![b.x, b.y, b.w, b.h].every(Number.isFinite)) fail(`"${id}" needs numeric x, y, w, h`);
    }
    if (b.role) {
      if (!["guide", "sensor"].includes(b.role.type)) fail(`"${id}" role.type must be guide or sensor`);
      if (!["computational", "inferential"].includes(b.role.method))
        fail(`"${id}" role.method must be computational or inferential`);
    }
    if (!b.info || !b.info.summary) fail(`"${id}" needs info.summary`);
    if (b.info.link) fail(`"${id}" uses info.link; point to a resource with info.source instead`);
    if (b.info.source && !resourceIds.has(b.info.source))
      fail(`"${id}" info.source "${b.info.source}" is not in resources.json`);
    for (const p of b.parts || []) {
      if (!blocks[p]) fail(`"${id}" lists unknown part "${p}"`);
      if (blocks[p].in !== id) fail(`part "${p}" must have in: "${id}"`);
    }
  }

  // groups nest: a member is a block or another group; each member has exactly one parent group
  const groups = arch.groups || [];
  const groupIds = new Set(groups.map((g) => g.id));
  const owner = {};
  groups.forEach((g) => {
    if (!g.label || !Array.isArray(g.members) || !g.members.length)
      fail(`group "${g.id}" needs a label and members`);
    if (ids.has(g.id)) fail(`group id "${g.id}" clashes with a block id`);
    g.members.forEach((m) => {
      if (!ids.has(m) && !groupIds.has(m)) fail(`group "${g.id}" has unknown member "${m}"`);
      if (m === g.id) fail(`group "${g.id}" contains itself`);
      if (owner[m]) fail(`"${m}" is in two groups: "${owner[m]}" and "${g.id}"`);
      owner[m] = g.id;
    });
  });
  if (arch.zones) fail('"zones" was renamed to "groups"');

  const seen = new Set();
  arch.edges.forEach((e, i) => {
    const pair = [e.from, e.to].sort().join("|");
    if (seen.has(pair))
      fail(`edge #${i} duplicates ${e.from} <-> ${e.to}; use "both": true for a two-way link`);
    seen.add(pair);
    if (!ids.has(e.from)) fail(`edge #${i} from unknown block "${e.from}"`);
    if (!ids.has(e.to)) fail(`edge #${i} to unknown block "${e.to}"`);
    if (blocks[e.from].kind === "part" || blocks[e.to].kind === "part")
      fail(`edge #${i} connects a part; parts are drawn inside blocks, not wired`);
  });

  tasks.tasks.forEach((t) => {
    t.steps.forEach((s, i) => {
      const where = `task "${t.name}" step ${i + 1}`;
      s.act.forEach((id) => ids.has(id) || fail(`${where}: unknown id "${id}" in act`));
      Object.keys(s.annotations).forEach((id) =>
        ids.has(id) || fail(`${where}: unknown id "${id}" in annotations`)
      );
      if (s.fail && !ids.has(s.fail)) fail(`${where}: unknown fail id "${s.fail}"`);
    });
  });
}

function validateGlossary(glossary, blocks, resourceIds) {
  const seen = new Set();
  const groups = new Set((glossary.groups || []).map((g) => g.id));
  if (glossary.eras) fail('glossary "eras" was replaced by "groups"');
  glossary.terms.forEach((t) => {
    if (seen.has(t.id)) fail(`glossary term "${t.id}" is used twice`);
    seen.add(t.id);
    if (!t.term || !t.definition) fail(`glossary term "${t.id}" needs term and definition`);
    if (t.block && !blocks[t.block]) fail(`glossary term "${t.id}" points to unknown block "${t.block}"`);
    if (t.source && !resourceIds.has(t.source)) fail(`glossary term "${t.id}" source "${t.source}" is not in resources.json`);
    if (!groups.has(t.group)) fail(`glossary term "${t.id}" needs a known group, not "${t.group}"`);
  });
}

function validateSite(site) {
  if (!site.title) fail("site.json needs a title");
  if (!String(site.repoUrl || "").startsWith("https://")) fail("site.json repoUrl must be an https URL");
  if (site.storyUrl && !String(site.storyUrl).startsWith("https://")) fail("site.json storyUrl must be an https URL");
  if (site.url && !String(site.url).startsWith("https://")) fail("site.json url must be an https URL");
}

export function validateAll({ architecture, tasks, resources, glossary, site }) {
  const resourceIds = new Set();
  validateResources(resources, resourceIds);
  validateArchitecture(architecture, tasks, resourceIds);
  validateGlossary(glossary, architecture.blocks, resourceIds);
  validateSite(site);
  return true;
}
