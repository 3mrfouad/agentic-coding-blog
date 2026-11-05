import { GLOSSARY, RESOURCE_BY_ID, SITE, TASKS, RESOURCES } from "../data/index.js";
import { exploreHref } from "../site/routing.js";

// The loop in one picture. Wide on large screens, stacked on narrow ones.
function LoopFigure() {
  return (
    <figure className="loop-figure">
      <svg className="lf-wide" viewBox="0 0 760 236" role="img" aria-labelledby="loop-title loop-desc">
        <title id="loop-title">The agent loop</title>
        <desc id="loop-desc">
          A task goes into the context window. The LLM reads it and replies with tool calls. The agent loop runs them
          with tools, and the results and checks go back into the context window.
        </desc>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="lf-arrow" />
          </marker>
        </defs>
        <g className="lf-box">
          <rect x="10" y="78" width="96" height="52" rx="10" />
          <text x="58" y="109">Task</text>
        </g>
        <g className="lf-box lf-strong">
          <rect x="146" y="78" width="150" height="52" rx="10" />
          <text x="221" y="109">Context window</text>
        </g>
        <g className="lf-core">
          <circle cx="384" cy="104" r="44" />
          <text x="384" y="109">LLM</text>
        </g>
        <g className="lf-box">
          <rect x="470" y="78" width="124" height="52" rx="10" />
          <text x="532" y="109">Agent loop</text>
        </g>
        <g className="lf-box">
          <rect x="634" y="78" width="116" height="52" rx="10" />
          <text x="692" y="104">Tools and</text>
          <text x="692" y="120">checks</text>
        </g>
        <g className="lf-line">
          <path d="M106 104 H142" markerEnd="url(#arrow)" />
          <path d="M296 104 H336" markerEnd="url(#arrow)" />
          <path d="M428 104 H466" markerEnd="url(#arrow)" />
          <path d="M594 104 H630" markerEnd="url(#arrow)" />
          <path className="lf-return" d="M692 130 V188 Q692 200 680 200 H233 Q221 200 221 188 V134" markerEnd="url(#arrow)" />
        </g>
        <text className="lf-label" x="384" y="40">the model's only input and output</text>
        <path className="lf-bracket" d="M300 52 H468" />
        <text className="lf-label lf-accent" x="456" y="222">results and failed checks come back as context</text>
      </svg>
      <svg className="lf-tall" viewBox="0 0 320 452" role="img" aria-labelledby="loop-title-t loop-desc-t">
        <title id="loop-title-t">The agent loop</title>
        <desc id="loop-desc-t">
          A task goes into the context window. The LLM reads it and replies with tool calls. The agent loop runs them
          with tools, and the results and checks go back into the context window.
        </desc>
        <defs>
          <marker id="arrow-t" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="lf-arrow" />
          </marker>
        </defs>
        <g className="lf-box">
          <rect x="70" y="8" width="150" height="44" rx="10" />
          <text x="145" y="35">Task</text>
        </g>
        <g className="lf-box lf-strong">
          <rect x="70" y="84" width="150" height="44" rx="10" />
          <text x="145" y="111">Context window</text>
        </g>
        <g className="lf-core">
          <circle cx="145" cy="204" r="42" />
          <text x="145" y="209">LLM</text>
        </g>
        <g className="lf-box">
          <rect x="70" y="280" width="150" height="44" rx="10" />
          <text x="145" y="307">Agent loop</text>
        </g>
        <g className="lf-box">
          <rect x="70" y="356" width="150" height="44" rx="10" />
          <text x="145" y="383">Tools and checks</text>
        </g>
        <g className="lf-line">
          <path d="M145 52 V80" markerEnd="url(#arrow-t)" />
          <path d="M145 128 V158" markerEnd="url(#arrow-t)" />
          <path d="M145 246 V276" markerEnd="url(#arrow-t)" />
          <path d="M145 324 V352" markerEnd="url(#arrow-t)" />
          <path className="lf-return" d="M220 378 H268 Q280 378 280 366 V118 Q280 106 268 106 H224" markerEnd="url(#arrow-t)" />
        </g>
        <text className="lf-label lf-accent" x="160" y="434">results and failed checks come back as context</text>
      </svg>
      <figcaption>The model sees only its context window and can only ask for tool calls. Everything around it decides how good the work is.</figcaption>
    </figure>
  );
}

// Three things decide how well an agent works; each holds two habits from the teams who run agents every day.
const AREAS = [
  {
    title: "Give it the right context",
    text: "What the model knows is what reaches its context window.",
    habits: [
      { id: "cx_instr", name: "Write your rules down once", detail: "Build, test and style rules in AGENTS.md, so every session starts with them.", source: "agents-md" },
      { id: "logs", name: "Let it see production", detail: "Tool access to logs, metrics and errors, so it can confirm a fix after deploy.", source: "openai-harness" },
    ],
  },
  {
    title: "Check every change",
    text: "Mistakes are cheapest while the agent is still working.",
    habits: [
      { id: "sensors", name: "Make checks fast and loud", detail: "Tests, types and lint on every change, with messages that say how to fix.", source: "openai-harness" },
      { id: "s_arch", name: "Turn architecture into checks", detail: "\"No server imports in client code\" catches more as a check than as a review comment.", source: "openai-harness" },
    ],
  },
  {
    title: "Limit what it can break",
    text: "A mistake that cannot spread is a small one.",
    habits: [
      { id: "e_worktree", name: "Give each task its own workspace", detail: "A worktree and branch per task keeps parallel work apart.", source: "claude-bp" },
      { id: "gate", name: "Gate what is risky", detail: "Reads run freely; pushes, deletes and network calls ask first.", source: "codex-sandbox" },
    ],
  },
];

export default function Landing() {
  const sources = RESOURCES.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      <section className="site-wrap hero2">
        <div className="hero2-text">
          <p className="eyebrow">Open source · Interactive</p>
          <h1>An attempt to understand agentic coding</h1>
          <p className="lede">
            <strong>A coding agent is more than its model.</strong> The model sees one thing: its context window. What
            goes in, what checks the work, and what the agent may touch decide how often it gets things right.
          </p>
          <div className="cta-row">
            <a className="btn primary big" href="#/explore">
              Explore the diagram
            </a>
            <a className="btn big" href={SITE.repoUrl} target="_blank" rel="noopener noreferrer">
              View on GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="hero-facts">
            {TASKS.length} real scenarios · {sources} primary sources · free and open source
          </p>
        </div>
        <div className="hero2-figure">
          <LoopFigure />
        </div>
      </section>

      <section className="site-wrap section tight" aria-labelledby="note-h">
        <aside className="author-note">
          <h2 id="note-h">Why I built this</h2>
          <p>
            Agentic coding moved faster than I could keep up with. Every few weeks brought a new workflow and a new term:
            context engineering, MCP, skills, hooks, subagents. Each one made sense on its own, but I could not see how
            they fit together, or which of them would actually help my agent make fewer mistakes.
          </p>
          <p>
            I spent time digging through docs and posts to piece it together. This site is the picture I wished I had
            when I started.
          </p>
          {SITE.storyUrl && (
            <p className="note-link">
              <a href={SITE.storyUrl} target="_blank" rel="noopener noreferrer">
                {SITE.storyLabel || "Read the full story"} <span aria-hidden="true">↗</span>
              </a>
            </p>
          )}
        </aside>
      </section>

      <section className="site-wrap section" aria-labelledby="areas-h">
        <h2 id="areas-h">Three things decide how well it works</h2>
        <div className="grid three">
          {AREAS.map((a) => (
            <article key={a.title} className="tile area">
              <h3>{a.title}</h3>
              <p className="area-text">{a.text}</p>
              <ul className="habit-list">
                {a.habits.map((h) => (
                  <li key={h.id}>
                    <strong>{h.name}</strong>
                    <span>{h.detail}</span>
                    <span className="tile-links">
                      <a href={exploreHref(h.id)}>See it in the diagram</a>
                      {RESOURCE_BY_ID[h.source] && (
                        <>
                          {" · "}
                          <a href={RESOURCE_BY_ID[h.source].url} target="_blank" rel="noopener noreferrer">
                            {RESOURCE_BY_ID[h.source].publisher} <span aria-hidden="true">↗</span>
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="site-wrap section" aria-labelledby="names-h">
        <h2 id="names-h">The names keep changing. The loop stays the same.</h2>
        <p className="section-lede">
          New terms arrive all the time, and each one names a part of the same loop. Select a term to see where it sits.
        </p>
        <div className="term-groups">
          {GLOSSARY.groups.map((g) => (
            <div key={g.id} className="term-group">
              <h3>{g.label}</h3>
              <ul className="term-chips">
                {GLOSSARY.terms
                  .filter((t) => t.group === g.id)
                  .map((t) => (
                    <li key={t.id}>
                      <a href={exploreHref(t.block)} title={t.definition}>
                        {t.term}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="more-link">
          <a href="#/library?section=glossary">Every term, defined</a>
        </p>
      </section>

      <section className="site-wrap section">
        <div className="callout">
          <div>
            <h2>Built in the open</h2>
            <p>Add a scenario, correct a box, or suggest a source. Everything on the page comes from a few JSON files.</p>
          </div>
          <div className="cta-row">
            <a className="btn primary" href={SITE.repoUrl} target="_blank" rel="noopener noreferrer">
              Contribute on GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
