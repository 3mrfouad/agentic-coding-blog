// Hierarchical layout with ELK. Groups are compound nodes: ELK sizes each group to fit its members
// and keeps siblings apart. ELK also routes every line around the boxes; those routes are returned
// so the app draws the lines exactly as they were planned. Parts are not laid out here.
import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();
const GROUP_PADDING = "[top=50,left=26,bottom=26,right=26]";

// Boxes in the same column share a left edge (wide), or a top edge (narrow).
function toElk(id, NODES, groupById, align) {
  const g = groupById[id];
  if (g) {
    return {
      id,
      layoutOptions: { "elk.padding": GROUP_PADDING, "elk.alignment": align },
      children: g.members.map((m) => toElk(m, NODES, groupById, align)),
    };
  }
  return { id, width: NODES[id].w, height: NODES[id].h, layoutOptions: { "elk.alignment": align } };
}

/**
 * @returns {Promise<{ pos, parent, routes }>}
 *   pos:     position of every block and group (children relative to their parent group)
 *   parent:  child id -> group id
 *   routes:  "from>to" -> [{x, y}, ...] absolute points, start to end, for every edge
 */
export async function layoutTree(NODES, EDGES, GROUPS, horizontal, override = {}) {
  const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const parent = {};
  GROUPS.forEach((g) => g.members.forEach((m) => (parent[m] = g.id)));

  const blocks = Object.keys(NODES).filter((id) => NODES[id].k !== "part");
  // top-level order follows the groups' order in the data: the direction work flows
  const topLevel = [
    ...GROUPS.map((g) => g.id).filter((id) => !parent[id]),
    ...blocks.filter((id) => !parent[id] && !NODES[id].in),
  ];

  // flow order: depth-first through the groups as listed, then any ungrouped block
  const rank = {};
  let next = 0;
  const visit = (id) => {
    if (groupById[id]) groupById[id].members.forEach(visit);
    else if (rank[id] === undefined) rank[id] = next++;
  };
  topLevel.forEach(visit);

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": horizontal ? "RIGHT" : "DOWN",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "28",
      "elk.spacing.edgeNode": "18",
      "elk.spacing.edgeEdge": "10",
      "elk.spacing.componentComponent": "40",
      "elk.layered.spacing.nodeNodeBetweenLayers": "60",
      "elk.layered.spacing.edgeNodeBetweenLayers": "20",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "10",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
      "elk.layered.thoroughness": "20",
      // keep groups in the order work flows through them
      "elk.layered.cycleBreaking.strategy": "MODEL_ORDER",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      ...override,
    },
    children: topLevel.map((id) => toElk(id, NODES, groupById, horizontal ? "LEFT" : "TOP")),
    // Work flows in the order the groups and their members are listed. Lines that go downstream
    // get priority to point in the layout direction, so the loop is broken at the return lines.
    edges: EDGES.map((e, i) => ({
      id: `e${i}`,
      sources: [e.from],
      targets: [e.to],
      layoutOptions: { "elk.layered.priority.direction": String(rank[e.from] < rank[e.to] ? 10 : 0) },
    })),
  };

  const out = await elk.layout(graph);

  const pos = {};
  const walk = (node) => {
    pos[node.id] = { x: node.x, y: node.y, width: node.width, height: node.height };
    (node.children || []).forEach(walk);
  };
  (out.children || []).forEach(walk);

  // absolute position of a block or group (ELK stores children relative to their parent)
  const abs = {};
  const absOf = (id) => {
    if (!id) return { x: 0, y: 0 };
    if (abs[id]) return abs[id];
    const base = absOf(parent[id]);
    abs[id] = { x: base.x + pos[id].x, y: base.y + pos[id].y };
    return abs[id];
  };
  Object.keys(pos).forEach(absOf);

  // ELK gives a route relative to the innermost group holding both ends (their lowest common
  // ancestor). Shift it by that group's absolute position so it lines up with the boxes.
  const ancestors = (id) => {
    const out = [];
    let p = parent[id];
    while (p) {
      out.push(p);
      p = parent[p];
    }
    return out;
  };
  const lca = (a, b) => {
    const bs = new Set(ancestors(b));
    return ancestors(a).find((g) => bs.has(g)) || null;
  };

  const routes = {};
  (out.edges || []).forEach((edge) => {
    const e = EDGES[Number(edge.id.slice(1))];
    const section = (edge.sections || [])[0];
    if (!section) return;
    const o = absOf(lca(e.from, e.to));
    routes[e.from + ">" + e.to] = [section.startPoint, ...(section.bendPoints || []), section.endPoint].map((p) => ({
      x: p.x + o.x,
      y: p.y + o.y,
    }));
  });

  // a line that runs against the flow order is a return line (results, feedback, review)
  const back = Object.fromEntries(EDGES.map((e) => [e.from + ">" + e.to, rank[e.from] > rank[e.to]]));

  // the box sizes this layout was planned with, so the app can tell when a box was resized since
  const dims = Object.fromEntries(blocks.map((id) => [id, { w: NODES[id].w, h: NODES[id].h }]));

  return { pos, parent, routes, abs, back, dims };
}
