import { SITE } from "../data/index.js";

export default function News() {
  return (
    <div className="site-wrap narrow">
      <header className="page-head">
        <p className="eyebrow">News</p>
        <h1>Agentic coding news</h1>
        <p className="badge" role="status">
          Under construction
        </p>
        <p className="lede">
          A short, curated feed of what changes in agentic coding: new tools, new practices, and the research behind
          them. It is not live yet.
        </p>
      </header>
      <div className="tile empty-state">
        <h2>Until then</h2>
        <p>
          The <a href="#/library">Library</a> has the primary sources behind the diagram, and the{" "}
          <a href="#/explore">explorer</a> shows how the pieces fit together.
        </p>
        <p>
          Have ideas for how this page should work?{" "}
          <a href={SITE.repoUrl + "/issues"} target="_blank" rel="noopener noreferrer">
            Open an issue on GitHub <span aria-hidden="true">↗</span>
          </a>
        </p>
      </div>
    </div>
  );
}
