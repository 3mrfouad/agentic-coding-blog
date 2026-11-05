# Architecture data

Everything the site shows comes from the JSON files in this folder.
`validate.js` checks every reference. It runs when the app loads and with `npm run check`, and fails with a clear message on the first problem.

## The model this data describes

The LLM has one input, the **context window**, and one output, text and tool calls.
The **agent loop** is the hub: it builds the context, calls the model, sends each tool call
through the **permission gate**, runs it, and appends the result back into the context.
Anything that should influence the model, including sensor results and human comments,
has to reach it through the context window. Edges should follow that rule.

## architecture.json

- `blocks`: keyed by id.
  - `label`: text shown on the block.
  - `kind`: `block`, `gate` (permission gate), `ext` (outside the repo, dashed), `core` (the LLM), or `part`.
  - `x`, `y`, `w`, `h`: default position and size. The layout replaces the position; `w` and `h` are minimums.
  - `parts`: ids of blocks this block is *made of*. They render inside it. No arrows.
  - `in`: on a part, the block it belongs to.
  - `info`: `{ summary, example?, source? }` for the popover.
    - `summary`: one or two plain sentences. Required.
    - `example`: only when it shows something the summary does not. Leave it out rather than add a bare value.
    - `source`: the id of an entry in `resources.json`, shown as the popover's link.
  - `role` (optional): Fowler's classification, `{ type: "guide" | "sensor", method: "computational" | "inferential" }`.
    Guides act before a change (AGENTS.md, language server); sensors report after it (tests, review agent).
    Shown as a G or S badge, solid for computational and dashed for inferential.
- `edges`: what *feeds into* or drives what. `{ from, to, label?, dashed?, feedback?, both? }`.
  - `dashed`: human steering or a return path.
  - `feedback`: the sensor results line, shown in red when a check fails.
  - `both`: a two-way relationship drawn as one edge. Duplicate pairs are rejected.
- `groups`: nested frames, `{ id, label, members }`. A member is a block or another group, and belongs to one group.
  **Order matters**: groups, and members within a group, are listed in the order work flows through them.
  The layout uses that order to draw the flow top to bottom, and treats lines that go against it as return lines.

Rule of thumb: if it lives inside the box, it is a part. If it sends something into the box, it is an edge.

## resources.json

The single list of further reading. The sidebar shows it grouped, and popovers link to it by id.

- `groups`: `{ id, label }`, in display order.
- `items`: `{ id, group, title, publisher, year?, url, about }`. `url` must be `https://`.
  Add only sources you have opened and checked, and prefer primary ones: the people who built the thing,
  or its official docs.

## glossary.json

The terms on the home page and in the Library.

- `eras`: `{ id, label, focus, about }`, in order. Each idea widens the one before it.
- `terms`: `{ id, era, term, definition, block?, source? }`. `block` links the term to its box in the diagram,
  `source` to an entry in `resources.json`.

## site.json

- `title`, `tagline`, `license`.
- `repoUrl`: the GitHub repository address. Every GitHub link on the site comes from here.
- `storyUrl`, `storyLabel` (optional): the article linked from "Why I built this" on the home page. Leave `storyUrl` out to hide the link.

## tasks.json

- `tasks[]`: `name`, `description`, and `steps`.
- Each step:
  - `text`: the caption.
  - `act`: ids active during the step. Parents of active parts light up automatically.
  - `annotations`: short example text shown as chips for specific ids.
  - `fail`: optional id of a block or part to show as failing.

## Adding things

- New part: add a block with `kind: "part"` and `in`, and list it in the parent's `parts`.
- New feed: add an edge. Keep it to flows that really happen.
- New box: add it to one group, at the point in the order where it sits in the flow.
- New task: append to `tasks`. Every id in `act`, `annotations` and `fail` must exist.
