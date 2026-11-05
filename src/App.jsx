import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BaseEdge,
  ControlButton,
  EdgeLabelRenderer,
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  NodeResizeControl,
  Panel,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  getViewportForBounds,
  useNodesInitialized,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { NODES, EDGES, PARENT, TASKS, GROUPS, SITE } from "./data/index.js";
import { layoutTree } from "./layout.js";

// ---------- theme ----------

const NARROW = "(max-width: 900px)";

// motion is skipped for people who ask their system for less of it
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ms = (n) => (reduceMotion() ? 0 : n);

// `backticks` in the data mark code: shown in monospace and never broken mid-token
function Rich({ text }) {
  if (!text) return null;
  return text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

const cls = (...xs) => xs.filter(Boolean).join(" ");

// Fowler's classification: guides act before the change, sensors report after it;
// computational ones are deterministic tools, inferential ones are model-based.
const ROLE_LABEL = {
  "guide/computational": "Computational guide",
  "guide/inferential": "Inferential guide",
  "sensor/computational": "Computational sensor",
  "sensor/inferential": "Inferential sensor",
};
const roleKey = (r) => (r ? `${r.type}/${r.method}` : null);

function RoleBadge({ role }) {
  if (!role) return null;
  return (
    <span className={cls("role", role.type, role.method)} title={ROLE_LABEL[roleKey(role)]} aria-label={ROLE_LABEL[roleKey(role)]}>
      {role.type === "guide" ? "G" : "S"}
    </span>
  );
}

// Lets nodes ask for an info card or a focus change without knowing about either.
const Actions = createContext({ info: () => {}, focus: () => {} });
// Resizing boxes and reshaping lines.
const Editing = createContext({ resized: () => {}, resetSize: () => {}, setRoute: () => {}, resetRoute: () => {}, hover: () => {}, unhover: () => {} });

// the point an element was clicked at, in screen coordinates
function anchorOf(el) {
  const r = el.getBoundingClientRect();
  const pt = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, prefer: "right" };
  // a sub-box opens its card away from the middle of its container, so its siblings stay clickable
  const container = el.closest(".part") && el.closest(".container");
  if (container) {
    const c = container.getBoundingClientRect();
    pt.prefer = pt.clientX < c.left + c.width / 2 ? "left" : "right";
    pt.edge = pt.prefer === "left" ? c.left : c.right;
  }
  return pt;
}

// ---------- layout constants ----------
const HEADER = 34;
const PAD = 14;
const PART_W = 172;
const PART_H = 26;
const GAP_X = 10;
const GAP_Y = 8;
const ZONE_PAD = 22;
const ZONE_TOP = 40;
const DIM = 0.2;

function partSlot(index, count) {
  const cols = count > 1 ? 2 : 1;
  return {
    x: PAD + (index % cols) * (PART_W + GAP_X),
    y: HEADER + Math.floor(index / cols) * (PART_H + GAP_Y),
  };
}

// ---------- handles (anchors for edges only) ----------
const SIDES = [
  ["t", Position.Top],
  ["r", Position.Right],
  ["b", Position.Bottom],
  ["l", Position.Left],
];

function Handles() {
  return (
    <>
      {SIDES.map(([s, p]) => (
        <Handle key={"s" + s} id={"s-" + s} type="source" position={p} className="hid" />
      ))}
      {SIDES.map(([s, p]) => (
        <Handle key={"t" + s} id={"t-" + s} type="target" position={p} className="hid" />
      ))}
    </>
  );
}

// Click and keyboard activation for a clickable element
function activate(fn, id) {
  return {
    onClick: (e) => {
      e.stopPropagation();
      fn(id);
    },
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn(id);
      }
    },
    role: "button",
    tabIndex: 0,
  };
}

// ---------- node components ----------
// (i) opens the info card. It stops the click so the box body does not also focus.
function InfoButton({ id, label, size = "md" }) {
  const { info } = useContext(Actions);
  return (
    <button
      className={cls("info-btn", size)}
      aria-label={`About ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        info(id, anchorOf(e.currentTarget));
      }}
    >
      i
    </button>
  );
}

// A small corner grip, shown only on hover (or on the focused box on touch screens).
// Drag to resize; double-click to go back to the default size.
function ResizeGrip({ id, minWidth, minHeight, keepAspectRatio = false }) {
  const { resized, resetSize } = useContext(Editing);
  return (
    <NodeResizeControl
      position="bottom-right"
      minWidth={minWidth}
      minHeight={minHeight}
      keepAspectRatio={keepAspectRatio}
      className="resize-grip"
      style={{ background: "transparent", border: "none" }}
      onResizeEnd={(_, p) => resized(id, { w: Math.round(p.width), h: Math.round(p.height) })}
    >
      <span
        className="grip-mark"
        title="Drag to resize. Double-click to reset."
        onDoubleClick={(e) => {
          e.stopPropagation();
          resetSize(id);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M9 3 L3 9 M9 6 L6 9" />
        </svg>
      </span>
    </NodeResizeControl>
  );
}

function BlockNode({ id, data }) {
  const { focus } = useContext(Actions);
  return (
    <div className={cls("block", data.kind, data.active && "on", data.failing && "fail")} {...activate(focus, id)}>
      <Handles />
      <RoleBadge role={data.role} />
      <span className="btext">{data.label}</span>
      <InfoButton id={id} label={data.label} size={data.size} />
      <ResizeGrip id={id} minWidth={110} minHeight={40} />
    </div>
  );
}

// A container draws its parts inside itself. Clicking the box focuses it; clicking a part
// focuses the part and opens its card.
function ContainerNode({ id, data }) {
  const { focus, info } = useContext(Actions);
  return (
    <div className={cls("container", data.kind, data.active && "on", data.failing && "fail")} {...activate(focus, id)}>
      <Handles />
      <div className="chead">
        <span className="ctitle">{data.label}</span>
        <InfoButton id={id} label={data.label} size="md" />
      </div>
      <ResizeGrip id={id} minWidth={data.minW} minHeight={data.minH} />
      {data.parts.map((p) => (
        <div
          key={p.id}
          className={cls("part", p.role && "has-role", p.active && "on", p.failing && "fail", p.focused && "focus")}
          style={{ left: p.x, top: p.y }}
          onClick={(e) => {
            e.stopPropagation();
            focus(p.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              focus(p.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <RoleBadge role={p.role} />
          <span className="ptext" title={p.label}>
            {p.label}
          </span>
          <InfoButton id={p.id} label={p.label} size="xs" />
        </div>
      ))}
    </div>
  );
}

function CoreNode({ id, data }) {
  const { focus } = useContext(Actions);
  return (
    <div className={cls("core", data.active && "on")} {...activate(focus, id)}>
      <Handles />
      <span>{data.label}</span>
      <InfoButton id={id} label={data.label} size="lg" />
      <ResizeGrip id={id} minWidth={110} minHeight={110} keepAspectRatio />
    </div>
  );
}

function ZoneNode({ data }) {
  const { focus } = useContext(Actions);
  return (
    <div className={cls("zone", `d${Math.min(data.depth, 2)}`, data.active && "on")}>
      <button
        className="zlabel"
        onClick={(e) => {
          e.stopPropagation();
          focus(data.zoneId);
        }}
      >
        {data.label}
      </button>
    </div>
  );
}

const nodeTypes = {
  block: BlockNode,
  container: ContainerNode,
  core: CoreNode,
  zone: ZoneNode,
};

// ---------- info card ----------
// One card for the whole canvas. It is anchored to the point that was clicked (flow coordinates),
// so it stays next to its trigger while the diagram pans and zooms.
function InfoCard({ openId, anchor, onClose }) {
  const partOf = openId && NODES[openId] ? NODES[openId].in : undefined;
  const key = openId ? partOf || openId : null;
  const host = useStore((s) => (key ? s.nodeLookup.get(key) : undefined));
  const transform = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const ref = useRef(null);
  const [cardH, setCardH] = useState(180);

  // measure the card so it can be centred on its trigger
  useLayoutEffect(() => {
    if (ref.current) setCardH(ref.current.offsetHeight);
  }, [openId]);

  if (!openId || !width || !height) return null;
  const n = NODES[openId];
  if (!n || !n.info) return null;

  let fx;
  let fy;
  if (anchor) {
    fx = anchor.x;
    fy = anchor.y;
  } else if (host) {
    const b = host.internals.positionAbsolute;
    fx = b.x + (host.measured?.width ?? n.w) / 2;
    fy = b.y + (host.measured?.height ?? n.h) / 2;
  } else {
    return null;
  }

  const [tx, ty, zoom] = transform;
  const sx = tx + fx * zoom;
  const sy = ty + fy * zoom;
  const GAP = 14;
  const cardW = Math.min(290, Math.max(200, width - 16));

  // beside the trigger; a sub-box's card clears its container's edge
  const prefer = anchor?.prefer || "right";
  const edgeX = anchor?.edge !== undefined ? tx + anchor.edge * zoom : sx;
  const rightX = (prefer === "right" ? edgeX : sx) + GAP;
  const leftX = (prefer === "left" ? edgeX : sx) - GAP - cardW;
  const fitsRight = rightX + cardW <= width - 8;
  const fitsLeft = leftX >= 8;

  let style;
  if ((prefer === "right" && fitsRight) || (prefer === "left" && !fitsLeft && fitsRight)) {
    style = { left: rightX, top: Math.min(Math.max(8, sy - cardH / 2), height - cardH - 8) };
  } else if (fitsLeft) {
    style = { left: leftX, top: Math.min(Math.max(8, sy - cardH / 2), height - cardH - 8) };
  } else {
    // no room on either side (narrow screens): above or below the trigger
    const x = Math.min(Math.max(8, sx - cardW / 2), width - cardW - 8);
    style = sy < height / 2 ? { left: x, top: sy + GAP } : { left: x, bottom: height - sy + GAP };
  }

  const info = n.info;
  return (
    <div
      ref={ref}
      className="pop open info-card"
      role="dialog"
      aria-label={n.t}
      style={{ width: cardW, transform: "none", ...style }}
    >
      <div className="pop-head">
        <div className="pop-title">{n.t}</div>
        <button className="pop-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      {n.role && <div className={cls("pop-role", n.role.type)}>{ROLE_LABEL[roleKey(n.role)]}</div>}
      <p className="pop-summary">
        <Rich text={info.summary} />
      </p>
      {info.example && (
        <p className="pop-example">
          <span>Example</span>
          <Rich text={info.example} />
        </p>
      )}
      {info.link && (
        <a className="pop-link" href={info.link.url} target="_blank" rel="noopener noreferrer">
          <span className="pop-link-pub">{info.link.publisher}</span>
          <span className="pop-link-title">
            {info.link.title} <span aria-hidden="true">↗</span>
          </span>
        </a>
      )}
    </div>
  );
}

// ---------- focus ----------
const GROUP_BY = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

// every block inside a group, at any depth
function leavesOf(id) {
  const g = GROUP_BY[id];
  if (!g) return [id];
  return g.members.flatMap(leavesOf);
}

// A focus key is a block id, a part id, or a group id.
// Focus = the core (what was clicked: a block, its container for a part, or every block in a group)
// plus the ring (every block connected to the core).
function computeFocus(key) {
  if (!key) return null;
  let core;
  let part = null;
  if (GROUP_BY[key]) {
    core = new Set(leavesOf(key));
  } else {
    const isPart = Boolean(NODES[key] && NODES[key].in);
    part = isPart ? key : null;
    core = new Set([isPart ? NODES[key].in : key]);
  }
  const ring = new Set();
  EDGES.forEach((e) => {
    if (core.has(e.from) && !core.has(e.to)) ring.add(e.to);
    if (core.has(e.to) && !core.has(e.from)) ring.add(e.from);
  });
  return { key, core, ring, part };
}

function focusLabel(focus) {
  if (GROUP_BY[focus.key]) return GROUP_BY[focus.key].label;
  if (focus.part) return NODES[focus.part].t;
  return NODES[focus.key].t;
}

function depthOf(id, parentOf) {
  let d = 0;
  let p = parentOf[id];
  while (p) {
    d++;
    p = parentOf[p];
  }
  return d;
}

// ---------- build React Flow nodes ----------
// Groups and blocks use their layout position, unless the user has dragged them (prev).
// A child's position is relative to its parent group, which is how React Flow stores it.
function buildNodes({ active, failId, prev = null, layout = null, sizes = {} }) {
  if (!layout) return [];
  const { pos, parent } = layout;
  const saved = Object.fromEntries((prev || []).map((n) => [n.id, n.position]));
  // a group may have grown to fit a resized or dragged box; keep that size between steps
  const grown = Object.fromEntries(
    (prev || []).filter((n) => n.type === "zone" && n.width && n.height).map((n) => [n.id, { w: n.width, h: n.height }])
  );
  const groupNodes = [];
  const blockNodes = [];

  GROUPS.forEach((g) => {
    const p = pos[g.id];
    if (!p) return;
    const lv = leavesOf(g.id);
    groupNodes.push({
      id: g.id,
      type: "zone",
      parentId: parent[g.id],
      position: saved[g.id] || { x: p.x, y: p.y },
      width: grown[g.id] ? Math.max(grown[g.id].w, p.width) : p.width,
      height: grown[g.id] ? Math.max(grown[g.id].h, p.height) : p.height,
      data: { label: g.label, zoneId: g.id, depth: depthOf(g.id, parent), active: lv.some((l) => active.has(l)) },
      selectable: false,
      draggable: false,
      focusable: false,
      connectable: false,
    });
  });

  Object.entries(NODES).forEach(([id, n]) => {
    if (n.k === "part" || !pos[id]) return;
    const data = {
      label: n.t,
      kind: n.k,
      active: active.has(id),
      failing: failId === id,
      size: n.k === "core" ? "lg" : n.h <= 48 ? "sm" : "md",
      role: n.role,
      minW: n.w,
      minH: n.h,
    };
    if (n.parts) {
      const count = n.parts.length;
      data.parts = n.parts.map((pid, idx) => ({
        id: pid,
        label: NODES[pid].t,
        role: NODES[pid].role,
        active: active.has(pid),
        failing: failId === pid,
        ...partSlot(idx, count),
      }));
    }
    blockNodes.push({
      id,
      type: n.parts ? "container" : n.k === "core" ? "core" : "block",
      parentId: parent[id],
      expandParent: Boolean(parent[id]),
      position: saved[id] || { x: pos[id].x, y: pos[id].y },
      width: (sizes[id] || n).w,
      height: (sizes[id] || n).h,
      data,
    });
  });

  return [...groupNodes.sort((a, b) => a.data.depth - b.data.depth), ...blockNodes];
}

// Absolute position of every node: React Flow stores children relative to their group.
function absolutePositions(nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const out = {};
  const abs = (id) => {
    if (out[id]) return out[id];
    const n = byId[id];
    if (!n) return { x: 0, y: 0 };
    const base = n.parentId ? abs(n.parentId) : { x: 0, y: 0 };
    out[id] = { x: base.x + n.position.x, y: base.y + n.position.y };
    return out[id];
  };
  nodes.forEach((n) => abs(n.id));
  return out;
}

// Dims what is not in focus. Only changes opacity and the part's focus flag, never positions.
// A soft focus (the opening view of the whole diagram) keeps everything readable; a normal focus,
// after a click, dims the rest strongly so the links stand out.
const SOFT_DIM = 0.6;

function applyFocus(node, focus, soft = false) {
  if (!focus) return node;
  const dim = soft ? SOFT_DIM : DIM;
  if (node.type === "zone") {
    const lit = focus.key === node.id || leavesOf(node.id).some((l) => focus.core.has(l) || focus.ring.has(l));
    return { ...node, style: { ...node.style, opacity: lit ? 1 : soft ? 0.85 : DIM + 0.1, transition: "opacity .3s" } };
  }
  const lit = focus.core.has(node.id) || focus.ring.has(node.id);
  const className = focus.core.has(node.id) ? "is-focus" : undefined;
  const data = node.data.parts
    ? { ...node.data, parts: node.data.parts.map((p) => ({ ...p, focused: p.id === focus.part })) }
    : node.data;
  return { ...node, className, data, style: { ...node.style, opacity: lit ? 1 : dim, transition: "opacity .3s" } };
}

// ---------- edges ----------
// Centre of a top-level box at its live position, so arrows re-route after a tidy or a drag.
function centerOf(id, positions, sizes = {}) {
  const n = NODES[id];
  const p = positions[id] || { x: n.x, y: n.y };
  const sz = sizes[id] || n;
  return { x: p.x + sz.w / 2, y: p.y + sz.h / 2 };
}

function sideFor(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "r" : "l";
  return dy > 0 ? "b" : "t";
}

// ---------- right-angle routes ----------
// A line leaves horizontally when the boxes are further apart horizontally, otherwise vertically
// (the same rule that picks the handle sides). Its middle segment sits at the midpoint unless the
// user has dragged it. Corners are rounded.
function elbowRoute(s, t, off) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
  if (Math.abs(dx) >= Math.abs(dy)) {
    const xm = mid.x + (off ? off.x : 0);
    return { pts: [s, { x: xm, y: s.y }, { x: xm, y: t.y }, t], handle: { x: xm, y: mid.y }, axis: "x", mid };
  }
  const ym = mid.y + (off ? off.y : 0);
  return { pts: [s, { x: s.x, y: ym }, { x: t.x, y: ym }, t], handle: { x: mid.x, y: ym }, axis: "y", mid };
}

function roundedPath(pts, radius = 10) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const p = pts[i];
    const next = pts[i + 1];
    const lenIn = Math.hypot(p.x - prev.x, p.y - prev.y) || 1;
    const lenOut = Math.hypot(next.x - p.x, next.y - p.y) || 1;
    const r = Math.min(radius, lenIn / 2, lenOut / 2);
    const a = { x: p.x - ((p.x - prev.x) / lenIn) * r, y: p.y - ((p.y - prev.y) / lenIn) * r };
    const b = { x: p.x + ((next.x - p.x) / lenOut) * r, y: p.y + ((next.y - p.y) / lenOut) * r };
    d += ` L ${a.x} ${a.y} Q ${p.x} ${p.y} ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

// Where a line's label goes: the middle of its longest segment, so it sits on open line
// rather than at a corner or against a box. Returns null when no segment is long enough.
function labelSpot(pts, minLen = 40) {
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (!best || len > best.len) best = { len, i };
  }
  if (!best || best.len < minLen) return null;
  const a = pts[best.i - 1];
  const b = pts[best.i];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// A line drawn along the route the layout planned, with rounded corners and its label on it.
// Moving one segment of a right-angle line. A horizontal segment moves up or down, a vertical one
// left or right. A segment that touches a box keeps a short stub on that box, so the line stays attached.
const STUB = 18;

function dragSegment(pts, k, to) {
  const a = pts[k - 1];
  const b = pts[k];
  const horizontal = Math.abs(b.y - a.y) < Math.abs(b.x - a.x);
  const at = (p, v) => (horizontal ? { x: p.x, y: v } : { x: v, y: p.y });
  const v = horizontal ? to.y : to.x;
  const out = pts.map((p) => ({ ...p }));
  const ux = Math.sign(b.x - a.x);
  const uy = Math.sign(b.y - a.y);
  const lastSeg = pts.length - 1;

  // end of the segment
  if (k === lastSeg) {
    const stub = { x: b.x - ux * STUB, y: b.y - uy * STUB };
    out.splice(k, 0, at(stub, v), stub);
  } else {
    out[k] = at(b, v);
  }
  // start of the segment
  if (k === 1) {
    const stub = { x: a.x + ux * STUB, y: a.y + uy * STUB };
    out.splice(1, 0, stub, at(stub, v));
  } else {
    out[k - 1] = at(a, v);
  }
  return simplify(out);
}

// drop repeated points and points that sit on a straight run
function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i > 0; i--) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    if ((Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5)) {
      out.splice(i, 1);
    }
  }
  return out;
}

// A line drawn along its route, with rounded corners and its label. Hovering it shows one small grip
// per segment long enough to grab; dragging a grip moves that segment.
function ElbowEdge({ id, sourceX, sourceY, targetX, targetY, style, markerStart, markerEnd, label, data }) {
  const { setRoute, resetRoute, hover, unhover, setAnchor, resetAnchor } = useContext(Editing);
  const rf = useReactFlow();
  const drag = useRef(null);
  const [endDrag, setEndDrag] = useState(null);
  const pts = data.points || elbowRoute({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }).pts;
  const path = roundedPath(pts);
  const m = labelSpot(pts);
  const showGrips = data.hovered || drag.current || endDrag;
  const ends = [
    { end: "source", p: pts[0] },
    { end: "target", p: pts[pts.length - 1] },
  ];

  const grips = [];
  if (showGrips) {
    for (let k = 1; k < pts.length; k++) {
      const len = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      if (len < 28) continue;
      grips.push({ k, x: (pts[k].x + pts[k - 1].x) / 2, y: (pts[k].y + pts[k - 1].y) / 2, horizontal: Math.abs(pts[k].y - pts[k - 1].y) < Math.abs(pts[k].x - pts[k - 1].x) });
    }
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={18}
        style={{ ...style, strokeLinejoin: "round", strokeLinecap: "round", ...(showGrips ? { strokeWidth: 2.4, opacity: 1 } : {}) }}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        {label && m && !showGrips && (
          <div className="edge-label" style={{ transform: `translate(-50%,-50%) translate(${m.x}px,${m.y}px)`, color: data.labelColor }}>
            {label}
          </div>
        )}
        {endDrag &&
          ["t", "r", "b", "l"].map((side) => {
            const q = anchorPoint(data.boxes[endDrag], { side, t: 0.5 });
            return <div key={side} className="anchor-dot" style={{ transform: `translate(-50%,-50%) translate(${q.x}px,${q.y}px)` }} />;
          })}
        {showGrips &&
          ends.map(({ end, p }) => (
            <div
              key={end}
              className={cls("end-grip nodrag nopan", data.anchored[end] && "custom")}
              style={{ transform: `translate(-50%,-50%) translate(${p.x}px,${p.y}px)` }}
              title="Drag to attach this end to another side. Double-click to reset."
              onPointerEnter={() => hover(id)}
              onPointerLeave={() => !endDrag && unhover(id)}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                const other = end === "source" ? "target" : "source";
                if (!data.anchored[other]) {
                  const op = other === "source" ? pts[0] : pts[pts.length - 1];
                  setAnchor(id, other, { ...nearestAnchor(data.boxes[other], op, data.round[other], true), auto: true });
                }
                setEndDrag(end);
                hover(id);
              }}
              onPointerMove={(e) => {
                if (endDrag !== end) return;
                const to = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
                setAnchor(id, end, { ...nearestAnchor(data.boxes[end], to, data.round[end]), auto: false });
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture?.(e.pointerId);
                setEndDrag(null);
                unhover(id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                resetAnchor(id, end);
              }}
            />
          ))}
        {grips.map((g) => (
          <div
            key={g.k}
            className={cls("edge-grip nodrag nopan", g.horizontal ? "ns" : "ew")}
            style={{ transform: `translate(-50%,-50%) translate(${g.x}px,${g.y}px)` }}
            title="Drag to move this part of the line. Double-click to reset."
            onPointerEnter={() => hover(id)}
            onPointerLeave={() => !drag.current && unhover(id)}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { k: g.k, from: pts };
              hover(id);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const to = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
              setRoute(id, dragSegment(drag.current.from, drag.current.k, to), data.ends);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture?.(e.pointerId);
              drag.current = null;
              unhover(id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              resetRoute(id);
            }}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { elbow: ElbowEdge };

// ---------- anchors: where a line's end sits on its box ----------
// An anchor is a side (t, r, b, l) and a position along it (0 to 1, 0.5 = the middle).
const NORMAL = { t: { x: 0, y: -1 }, r: { x: 1, y: 0 }, b: { x: 0, y: 1 }, l: { x: -1, y: 0 } };

function anchorPoint(box, a) {
  const t = a.t ?? 0.5;
  if (a.side === "t") return { x: box.x + t * box.w, y: box.y };
  if (a.side === "b") return { x: box.x + t * box.w, y: box.y + box.h };
  if (a.side === "l") return { x: box.x, y: box.y + t * box.h };
  return { x: box.x + box.w, y: box.y + t * box.h };
}

// The side point nearest the pointer. Snaps to the middle near the centre; a round box (the LLM)
// only offers the four middles, so the line always meets the circle.
function nearestAnchor(box, p, round, exact = false) {
  const clamp = (v) => (exact ? Math.min(1, Math.max(0, v)) : Math.min(0.9, Math.max(0.1, v)));
  const tx = clamp((p.x - box.x) / box.w);
  const ty = clamp((p.y - box.y) / box.h);
  const options = [
    { side: "t", t: tx }, { side: "b", t: tx }, { side: "l", t: ty }, { side: "r", t: ty },
  ].map((a) => {
    const q = anchorPoint(box, a);
    return { ...a, d: Math.hypot(q.x - p.x, q.y - p.y) };
  });
  const best = options.sort((m, n) => m.d - n.d)[0];
  if (exact) return { side: best.side, t: best.t };
  const t = round || Math.abs(best.t - 0.5) < 0.1 ? 0.5 : Math.round(best.t * 20) / 20;
  return { side: best.side, t };
}

// Does an axis-aligned segment pass through a box's inside?
function crosses(p, q, box) {
  const m = 1;
  const x1 = Math.min(p.x, q.x), x2 = Math.max(p.x, q.x), y1 = Math.min(p.y, q.y), y2 = Math.max(p.y, q.y);
  return x2 > box.x + m && x1 < box.x + box.w - m && y2 > box.y + m && y1 < box.y + box.h - m;
}

// Right-angle route from S (leaving along nS) to T (arriving against nT). Each end has a short stub,
// so the arrowhead points straight into its box. Several shapes are tried; any that cut through either
// box is rejected, and the shortest of the rest wins (bends count extra).
function anchoredRoute(S, nS, T, nT, A, B) {
  const a = { x: S.x + nS.x * STUB, y: S.y + nS.y * STUB };
  const b = { x: T.x + nT.x * STUB, y: T.y + nT.y * STUB };
  const M = STUB + 6;
  const left = Math.min(A.x, B.x) - M, right = Math.max(A.x + A.w, B.x + B.w) + M;
  const top = Math.min(A.y, B.y) - M, bottom = Math.max(A.y + A.h, B.y + B.h) + M;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const viaX = (x) => [a, { x, y: a.y }, { x, y: b.y }, b];
  const viaY = (y) => [a, { x: a.x, y }, { x: b.x, y }, b];
  const candidates = [
    [a, { x: b.x, y: a.y }, b],
    [a, { x: a.x, y: b.y }, b],
    viaX(mx), viaY(my), viaX(left), viaX(right), viaY(top), viaY(bottom),
  ];
  let best = null;
  for (const mid of candidates) {
    const path = simplify([S, ...mid, T]);
    // the stubs touch their own box by design; everything between must stay clear of both boxes
    const inner = simplify(mid);
    let clear = true;
    for (let i = 1; i < inner.length && clear; i++) {
      if (crosses(inner[i - 1], inner[i], A) || crosses(inner[i - 1], inner[i], B)) clear = false;
    }
    // the line must leave straight out of its side and arrive straight into the other, never sideways or folding back
    const first = path[1];
    const last = path[path.length - 2];
    const straightOut = (q, P, n) =>
      n.x !== 0 ? Math.abs(q.y - P.y) < 0.5 && Math.sign(q.x - P.x) === Math.sign(n.x) : Math.abs(q.x - P.x) < 0.5 && Math.sign(q.y - P.y) === Math.sign(n.y);
    const leavesRight = straightOut(first, S, nS);
    const entersRight = straightOut(last, T, nT);
    if (!clear || !entersRight || !leavesRight) continue;
    let len = 0;
    for (let i = 1; i < path.length; i++) len += Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
    const score = len + (path.length - 2) * 24;
    if (!best || score < best.score) best = { path, score };
  }
  return best ? best.path : simplify([S, ...viaX(mx), T]);
}

// Where a box is and how big it is: a reshaped line is only kept while both its ends stay put.
const endKey = (id, positions, sizes) => {
  const p = positions[id] || { x: 0, y: 0 };
  const sz = sizes[id] || NODES[id];
  return `${Math.round(p.x)},${Math.round(p.y)},${sz.w},${sz.h}`;
};

function buildEdges(active, failId, positions, focus, layout, sizes = {}, routes = {}, hovered = null, anchors = {}, soft = false) {
  const boxOf = (id) => {
    const p = positions[id] || { x: NODES[id].x, y: NODES[id].y };
    const sz = sizes[id] || NODES[id];
    return { x: p.x, y: p.y, w: sz.w, h: sz.h };
  };
  // A planned route is only valid while both ends are where, and the size, the layout planned for.
  // After a drag or resize, the line falls back to a simple right-angle route between the handles.
  const still = (id) => {
    const now = positions[id];
    const was = layout && layout.abs[id];
    const sz = sizes[id] || NODES[id];
    const planned = layout && layout.dims[id];
    return now && was && planned && Math.abs(now.x - was.x) < 0.5 && Math.abs(now.y - was.y) < 0.5 && sz.w === planned.w && sz.h === planned.h;
  };
  const route = (e) => {
    const key = e.from + ">" + e.to;
    const anc = anchors[key];
    const ends = endKey(e.from, positions, sizes) + "|" + endKey(e.to, positions, sizes) + "|" + JSON.stringify(anc || {});
    const mine = routes[key];
    if (mine && mine.ends === ends) return { points: mine.points, ends };
    if (anc) {
      // a moved end: route between the chosen sides; an end left alone keeps the side facing the other box
      const A = boxOf(e.from);
      const B = boxOf(e.to);
      const ca = { x: A.x + A.w / 2, y: A.y + A.h / 2 };
      const cb = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
      const sa = anc.source || { side: sideFor(cb.x - ca.x, cb.y - ca.y), t: 0.5 };
      const sb = anc.target || { side: sideFor(ca.x - cb.x, ca.y - cb.y), t: 0.5 };
      return { points: anchoredRoute(anchorPoint(A, sa), NORMAL[sa.side], anchorPoint(B, sb), NORMAL[sb.side], A, B), ends };
    }
    if (!layout || !still(e.from) || !still(e.to)) return { points: undefined, ends };
    return { points: layout.routes[key], ends };
  };
  return EDGES.map((e) => {
    const a = centerOf(e.from, positions, sizes);
    const b = centerOf(e.to, positions, sizes);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const on = active.has(e.from) && active.has(e.to);
    const feedbackFail = e.feedback && failId;
    const color = feedbackFail ? "var(--fail)" : "var(--accent)";
    const marker = {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: on ? (feedbackFail ? "var(--fail)" : "var(--accent)") : "var(--line)",
    };

    // return lines (results, feedback, review) are drawn only when a step or a focus uses them
    const isBack = Boolean(layout && layout.back[e.from + ">" + e.to]);
    let opacity = on ? 1 : isBack ? 0 : 0.4;
    if (focus) {
      const touchesCore = focus.core.has(e.from) || focus.core.has(e.to);
      const inView = (focus.core.has(e.from) || focus.ring.has(e.from)) && (focus.core.has(e.to) || focus.ring.has(e.to));
      // soft focus keeps the rest of the wiring visible; a normal focus hides what does not touch it
      opacity = touchesCore ? 1 : soft ? (isBack ? 0 : 0.3) : inView && !isBack ? 0.25 : on ? 0.25 : 0;
    }

    return {
      id: e.from + ">" + e.to,
      source: e.from,
      target: e.to,
      sourceHandle: "s-" + sideFor(dx, dy),
      targetHandle: "t-" + sideFor(-dx, -dy),
      type: "elbow",
      animated: on,
      label: on && e.label ? e.label : undefined,
      selectable: false,
      data: {
        labelColor: color,
        ...route(e),
        hovered: hovered === e.from + ">" + e.to,
        boxes: { source: boxOf(e.from), target: boxOf(e.to) },
        round: { source: NODES[e.from].k === "core", target: NODES[e.to].k === "core" },
        anchored: {
          source: Boolean(anchors[e.from + ">" + e.to]?.source && !anchors[e.from + ">" + e.to].source.auto),
          target: Boolean(anchors[e.from + ">" + e.to]?.target && !anchors[e.from + ">" + e.to].target.auto),
        },
      },
      style: {
        stroke: on ? color : "var(--line)",
        strokeWidth: on ? 2 : 1.4,
        strokeDasharray: !on && e.dashed ? "5 5" : undefined,
        opacity,
        transition: "stroke .4s, opacity .3s",
      },
      hidden: opacity === 0,
      markerStart: e.both ? marker : undefined,
      markerEnd: marker,
    };
  });
}

// ---------- camera ----------
// The view only moves when the user asks: "Fit all", "Tidy layout", or the first load.
// Focusing a box, stepping through a task, and rotating the screen leave the view where it is.
// Following a step: zoom to the boxes it uses, never closer than 1x. Only step changes trigger it,
// never a click on a box, and the Follow steps switch turns it off.
function StepFollower({ stepKey, boxes, follow, padding = 0.35 }) {
  const rf = useReactFlow();
  const width = useStore((st) => st.width);
  const height = useStore((st) => st.height);
  // the view already framed; empty at first, so the page opens framed on its first view
  const framed = useRef(null);
  const have = boxes.length > 0;
  useEffect(() => {
    if (!follow || !have || !width || !height || framed.current === stepKey) return;
    // Bounds come from the app's own positions and sizes, not React Flow's measurements, so a step is
    // never skipped while boxes are being re-rendered.
    const x1 = Math.min(...boxes.map((b) => b.x));
    const y1 = Math.min(...boxes.map((b) => b.y));
    const x2 = Math.max(...boxes.map((b) => b.x + b.w));
    const y2 = Math.max(...boxes.map((b) => b.y + b.h));
    framed.current = stepKey;
    const vp = getViewportForBounds({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 }, width, height, 0.1, 1, padding);
    rf.setViewport(vp, { duration: ms(800) });
    // stepKey stands in for boxes, which changes identity on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, follow, have, width, height]);
  return null;
}

function CameraController({ fitVersion }) {
  const rf = useReactFlow();
  // wait until every box has been measured, or the fit uses the wrong bounds
  const ready = useNodesInitialized();
  const done = useRef(0);
  useEffect(() => {
    if (fitVersion === 0 || !ready || done.current === fitVersion) return;
    done.current = fitVersion;
    // one frame later, so the new positions are on screen before fitting
    requestAnimationFrame(() => rf.fitView({ padding: 0.06, duration: ms(400) }));
  }, [fitVersion, ready, rf]);
  return null;
}

// Editing grips only make sense when the boxes are big enough to work on. Below this zoom the
// canvas is marked "far" and the grips switch off, so they can never sit on top of an (i).
const EDIT_ZOOM = 0.6;
function ZoomMark() {
  const far = useStore((s) => s.transform[2] < EDIT_ZOOM);
  useEffect(() => {
    const el = document.querySelector(".canvas");
    if (el) el.dataset.zoom = far ? "far" : "near";
  }, [far]);
  return null;
}

// Gives the card a way to convert a click point into flow coordinates.
function FlowBridge({ bridge }) {
  const rf = useReactFlow();
  bridge.current = rf.screenToFlowPosition;
  return null;
}

function shortTitle(text) {
  const words = text.replace(/`/g, "").split(/\s+/);
  return words.slice(0, 6).join(" ") + (words.length > 6 ? "…" : "");
}

// ---------- app ----------
export default function App({ focus: linkedFocus }) {
  // a link like #/explore?focus=lp_hooks opens with that box (or sub-box, or group) in focus
  const initialFocus = linkedFocus && (NODES[linkedFocus] || GROUP_BY[linkedFocus]) ? linkedFocus : "llm";
  const [task, setTask] = useState(0);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  // false = overview: no scenario step running. Play, Next or a step in the list starts the walkthrough.
  const [touring, setTouring] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [focusKey, setFocusKey] = useState(initialFocus);
  const [anchor, setAnchor] = useState(null);
  const bridge = useRef(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  const [follow, setFollow] = useState(true);
  const [sizes, setSizes] = useState({});
  const [routes, setRoutes] = useState({});
  const [anchors, setAnchors] = useState({});
  const [hoverEdge, setHoverEdge] = useState(null);
  const hoverTimer = useRef(null);
  // a drag or resize ends with a click; this stops that click from also toggling focus
  const justMoved = useRef(0);

  const steps = TASKS[task].steps;
  const step = steps[i];

  const active = useMemo(() => {
    if (!touring) return new Set();
    const s = new Set(step.act);
    step.act.forEach((id) => {
      if (PARENT[id]) s.add(PARENT[id]);
    });
    return s;
  }, [step, touring]);

  const focus = useMemo(() => computeFocus(focusKey), [focusKey]);

  const [layout, setLayout] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // zones and focus are derived from the nodes; nothing here moves a box
  // the opening view: whole diagram, LLM in soft focus
  const softFocus = !touring && !linkedFocus && focusKey === "llm";
  const displayNodes = useMemo(() => nodes.map((n) => applyFocus(n, focus, softFocus)), [nodes, focus, softFocus]);

  // latest highlight state, read by the async layout callback
  const latest = useRef({});
  latest.current = { active, fail: step.fail, sizes };

  const actions = useMemo(
    () => ({
      info: (id, pt) => {
        if (pt && bridge.current) {
          const at = bridge.current({ x: pt.clientX, y: pt.clientY });
          const edge = pt.edge !== undefined ? bridge.current({ x: pt.edge, y: pt.clientY }).x : undefined;
          setAnchor({ ...at, prefer: pt.prefer, edge });
        } else {
          setAnchor(null);
        }
        setOpenId((cur) => (cur === id ? null : id));
      },
      focus: (key) => {
        if (Date.now() - justMoved.current < 300) return;
        setFocusKey((cur) => (cur === key ? null : key));
      },
    }),
    []
  );

  const editing = useMemo(
    () => ({
      resized: (id, size) => {
        justMoved.current = Date.now();
        setSizes((s) => ({ ...s, [id]: size }));
      },
      resetSize: (id) => {
        justMoved.current = Date.now();
        setSizes((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
      },
      setRoute: (id, points, ends) => setRoutes((r) => ({ ...r, [id]: { points, ends } })),
      // moving an end re-routes the line, so any hand-dragged segments on it are dropped
      setAnchor: (id, end, anchor) => {
        setAnchors((a) => ({ ...a, [id]: { ...a[id], [end]: anchor } }));
        setRoutes((r) => {
          if (!r[id]) return r;
          const next = { ...r };
          delete next[id];
          return next;
        });
      },
      resetAnchor: (id, end) => {
        setAnchors((a) => {
          const mine = { ...a[id] };
          delete mine[end];
          // drop a pin that only existed to hold the other end still
          for (const k of Object.keys(mine)) if (mine[k].auto) delete mine[k];
          const next = { ...a };
          if (Object.keys(mine).length) next[id] = mine;
          else delete next[id];
          return next;
        });
        setRoutes((r) => {
          if (!r[id]) return r;
          const next = { ...r };
          delete next[id];
          return next;
        });
      },
      resetRoute: (id) =>
        setRoutes((r) => {
          const next = { ...r };
          delete next[id];
          return next;
        }),
      hover: (id) => {
        clearTimeout(hoverTimer.current);
        setHoverEdge(id);
      },
      // a short delay lets the pointer travel from the line onto a grip
      unhover: (id) => {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => setHoverEdge((cur) => (cur === id ? null : cur)), 350);
      },
    }),
    []
  );

  const clearAll = useCallback(() => {
    setFocusKey(null);
    setOpenId(null);
    setAnchor(null);
  }, []);

  // follow the screen width
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Escape clears focus and the card
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      clearAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearAll]);

  // automatic layout: on mount, on orientation change, and on demand
  const runLayout = useRef(() => {});
  runLayout.current = (fit = true) => {
    const { sizes: sz } = latest.current;
    const sized = Object.fromEntries(Object.entries(NODES).map(([id, n]) => [id, sz[id] ? { ...n, w: sz[id].w, h: sz[id].h } : n]));
    layoutTree(sized, EDGES, GROUPS, false).then((l) => {
      const { active: a, fail } = latest.current;
      setLayout(l);
      setRoutes({});
      setNodes(buildNodes({ active: a, failId: fail, prev: null, layout: l, sizes: sz }));
      if (fit) setLayoutVersion((v) => v + 1);
    });
  };
  // first load: lay out; with Follow steps on, the follower frames step 1 instead of fitting everything
  useEffect(() => {
    runLayout.current(!follow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // screen rotated: re-lay out, keep the view
  const firstNarrow = useRef(true);
  useEffect(() => {
    if (firstNarrow.current) {
      firstNarrow.current = false;
      return;
    }
    runLayout.current(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow]);

  // highlights, keeping dragged positions
  useEffect(() => {
    setNodes((prev) => buildNodes({ active, failId: touring ? step.fail : null, prev, layout, sizes }));
  }, [active, step.fail, touring, layout, sizes, setNodes]);

  // edges follow the live positions, so they re-route after a tidy or a drag
  useEffect(() => {
    const positions = absolutePositions(nodes);
    const live = Object.fromEntries(
      nodes.filter((n) => n.type !== "zone").map((n) => [n.id, { w: Math.round(n.width ?? n.measured?.width ?? NODES[n.id].w), h: Math.round(n.height ?? n.measured?.height ?? NODES[n.id].h) }])
    );
    setEdges(buildEdges(active, touring ? step.fail : null, positions, focus, layout, live, routes, hoverEdge, anchors, softFocus));
  }, [active, step.fail, touring, nodes, focus, layout, routes, hoverEdge, anchors, softFocus, setEdges]);

  // playback
  useEffect(() => {
    if (!playing) return;
    if (i >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setI((x) => x + 1), 3200);
    return () => clearTimeout(id);
  }, [playing, i, steps.length]);

  // entering the walkthrough clears the overview's LLM focus, so the step is what stands out
  const startTour = () => {
    if (!touring) {
      setTouring(true);
      setFocusKey(null);
      setOpenId(null);
    }
  };

  const selectTask = (n) => {
    setPlaying(false);
    setTask(n);
    setI(0);
    if (touring) clearAll();
  };

  const go = (n) => {
    setPlaying(false);
    if (n < 0) {
      // before step 1 is the overview
      setTouring(false);
      setI(0);
      setFocusKey(initialFocus);
      return;
    }
    startTour();
    setI(Math.max(0, Math.min(steps.length - 1, n)));
  };

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (!touring) {
      startTour();
      setI(0);
    } else if (i === steps.length - 1) setI(0);
    setPlaying(true);
  };

  const progress = touring ? ((i + 1) / steps.length) * 100 : 0;
  const overviewIds = useMemo(() => {
    const f = computeFocus(initialFocus);
    // a sub-box frames its container and links; a group frames its members
    return [...f.core, ...f.ring];
  }, [initialFocus]);
  // where the boxes to frame are, in absolute canvas coordinates, from the app's own node state
  const frameBoxesFor = (ids) => {
    const abs = absolutePositions(nodes);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    return ids.filter((id) => byId[id] && abs[id]).map((id) => ({ x: abs[id].x, y: abs[id].y, w: byId[id].width ?? NODES[id].w, h: byId[id].height ?? NODES[id].h }));
  };
  const stepBoxes = useMemo(
    () =>
      touring
        ? [...new Set(step.act.map((id) => (NODES[id] && NODES[id].in) || id))].filter((id) => NODES[id])
        : overviewIds,
    [step, touring, overviewIds]
  );
  // the overview shows the whole diagram; a link that names a box frames that box instead
  const wholeGraph = !touring && !linkedFocus;
  const frameBoxes = useMemo(
    () => frameBoxesFor(wholeGraph ? nodes.filter((n) => !n.parentId).map((n) => n.id) : stepBoxes),
    [nodes, stepBoxes, wholeGraph] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="app">
      <aside className="side">
        <header className="brand">
          <h1>Explore the agent</h1>
          <p className="intro">
            What an agent is made of, how its parts feed each other, and how a real task moves through them.
          </p>
        </header>

        {/* fixed-size controls first, so nothing above them changes height between steps */}
        <div className="player">
          <label className="scenario">
            <span>Scenario</span>
            <select value={task} onChange={(e) => selectTask(Number(e.target.value))}>
              {TASKS.map((t, n) => (
                <option key={t.name} value={n}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div className="controls">
            <button className="btn" onClick={() => go(i - 1)} disabled={!touring}>
              Previous
            </button>
            <button className="btn primary" onClick={togglePlay}>
              {playing ? "Pause" : "Play"}
            </button>
            <button className="btn" onClick={() => go(touring ? i + 1 : 0)} disabled={touring && i === steps.length - 1}>
              Next
            </button>
            <button className="btn" onClick={() => go(0)}>
              Restart
            </button>
          </div>

          <div className="progress-row">
            <div className="progress" aria-hidden="true">
              <div style={{ width: `${progress}%` }} />
            </div>
            <span className="step-count">
              {touring ? i + 1 : 0} / {steps.length}
            </span>
          </div>

          <label className="follow">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            <span>Follow steps</span>
            <small>zoom to each step's boxes</small>
          </label>

          <p className="desc">
            <Rich text={TASKS[task].desc} />
          </p>
        </div>

        <section className="card caption">
          <div className="step-label">{touring ? `Step ${i + 1} of ${steps.length}` : "Overview"}</div>
          <p>
            {touring ? (
              <Rich text={step.t} />
            ) : (
              <>
                {initialFocus === "llm" ? (
                  <>
                    The whole agent, with the LLM in focus. It reads only the context window and replies with tool
                    calls; the agent loop does the rest. Click any box to see its links, or press Play to walk through
                    the scenario.
                  </>
                ) : (
                  <>
                    {(NODES[initialFocus] || GROUP_BY[initialFocus]).t || GROUP_BY[initialFocus].label} is in focus,
                    with everything it connects to. Click any box to see its links, or press Play to walk through the
                    scenario.
                  </>
                )}
              </>
            )}
          </p>
        </section>

        <div className="chips">
          {(touring ? Object.keys(step.ann) : []).map((id) => (
            <span key={id} className="chip">
              <b>{NODES[id].t}</b> <Rich text={step.ann[id]} />
            </span>
          ))}
        </div>

        <nav className="steps" aria-label="Steps">
          <ol>
            {steps.map((s, n) => (
              <li key={n}>
                <button
                  className={cls("step-btn", touring && n === i && "on", touring && n < i && "done")}
                  aria-current={touring && n === i ? "step" : undefined}
                  onClick={() => go(n)}
                >
                  <span className="sn">{n + 1}</span>
                  <span className="st">{shortTitle(s.t)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section className="side-legend" aria-label="Legend">
          <p className="foot-h">Legend</p>
          <p className="edit-hint">
            Drag a box to move it, or its corner to resize. Hover a line: drag a dot to reroute it, or a square
            end to attach it to another side. Double-click any grip to reset. Zoom in to edit.
          </p>
          <div className="legend">
            <span>
              <i className="lg flow" /> flow
            </span>
            <span>
              <i className="lg feed" /> human steering
            </span>
            <span>
              <i className="lg madeof" /> made of
            </span>
            <span>
              <i className="lg ext" /> outside the repo
            </span>
            <span>
              <i className="role guide">G</i> guide
            </span>
            <span>
              <i className="role sensor">S</i> sensor
            </span>
          </div>
        </section>

      </aside>

      <main className="canvas">
        <Actions.Provider value={actions}>
          <Editing.Provider value={editing}>
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onPaneClick={() => {
              clearAll();
              setHoverEdge(null);
            }}
            onNodeDragStart={() => (justMoved.current = Date.now())}
            onNodeDragStop={() => (justMoved.current = Date.now())}
            onEdgeMouseEnter={(_, edge) => editing.hover(edge.id)}
            onEdgeMouseLeave={(_, edge) => editing.unhover(edge.id)}
            onEdgeClick={(_, edge) => editing.hover(edge.id)}
            panOnDrag
            zoomOnPinch
            zoomOnScroll
            zoomOnDoubleClick={false}
            minZoom={0.1}
            maxZoom={1.6}
            nodesConnectable={false}
            edgesFocusable={false}
            elementsSelectable={false}
          >
            <CameraController fitVersion={layoutVersion} />
            <StepFollower
              stepKey={touring ? `${task}:${i}` : "overview"}
              boxes={frameBoxes}
              follow={follow}
              padding={wholeGraph ? 0.06 : 0.35}
            />
            <FlowBridge bridge={bridge} />
            <ZoomMark />
            <InfoCard openId={openId} anchor={anchor} onClose={() => setOpenId(null)} />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls
              showInteractive={false}
              position={narrow ? "bottom-right" : "bottom-left"}
              fitViewOptions={{ padding: 0.06, duration: ms(400) }}
              aria-label="Canvas controls"
            >
              <ControlButton onClick={() => runLayout.current(true)} title="Tidy layout" aria-label="Tidy layout">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
                  <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
                  <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
                  <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
                </svg>
              </ControlButton>
            </Controls>
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                if (n.type === "zone") return "transparent";
                if (n.data?.active) return "var(--accent)";
                return n.type === "container" ? "var(--border)" : "var(--faint)";
              }}
            />
            {focus && (
              <Panel position="top-left">
                <div className="focus-banner">
                  <span>
                    Focus: <b>{focusLabel(focus)}</b>
                  </span>
                  <button className="btn small" onClick={clearAll}>
                    Clear
                  </button>
                </div>
              </Panel>
            )}
          </ReactFlow>
          </Editing.Provider>
        </Actions.Provider>
      </main>
    </div>
  );
}
