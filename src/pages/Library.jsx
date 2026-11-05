import { useEffect } from "react";
import { GLOSSARY, RESOURCES, RESOURCE_BY_ID, SITE } from "../data/index.js";
import { exploreHref } from "../site/routing.js";

export default function Library({ params }) {
  // #/library?section=glossary jumps straight to the glossary
  const section = params?.get("section");
  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ block: "start" });
  }, [section]);

  return (
    <div className="site-wrap narrow">
      <header className="page-head">
        <p className="eyebrow">Library</p>
        <h1>The sources behind the diagram</h1>
        <p className="lede">
          Primary sources only: the teams who build these agents, and the official docs. Every link was opened and
          checked before it was added.
        </p>
      </header>

      {RESOURCES.map((g) => (
        <section key={g.id} className="lib-group" aria-labelledby={`lib-${g.id}`}>
          <h2 id={`lib-${g.id}`}>{g.label}</h2>
          <ul className="lib-list">
            {g.items.map((r) => (
              <li key={r.id}>
                <a className="lib-item" href={r.url} target="_blank" rel="noopener noreferrer">
                  <span className="r-pub">
                    {r.publisher}
                    {r.year ? ` · ${r.year}` : ""}
                  </span>
                  <span className="lib-title">
                    {r.title} <span aria-hidden="true">↗</span>
                  </span>
                  <span className="r-about">{r.about}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section id="glossary" className="lib-group" aria-labelledby="glossary-h">
        <h2 id="glossary-h">Glossary</h2>
        <p className="section-lede">The terms you will meet, grouped by where they sit in the loop.</p>
        {GLOSSARY.groups.map((group) => (
          <div key={group.id} className="gloss-era">
            <h3>{group.label}</h3>
            <p className="gloss-about">{group.about}</p>
            <dl className="gloss">
              {GLOSSARY.terms
                .filter((t) => t.group === group.id)
                .map((t) => (
                  <div key={t.id} className="gloss-row">
                    <dt>{t.term}</dt>
                    <dd>
                      {t.definition}
                      <span className="gloss-links">
                        <a href={exploreHref(t.block)}>See in diagram</a>
                        {t.source && RESOURCE_BY_ID[t.source] && (
                          <>
                            {" · "}
                            <a href={RESOURCE_BY_ID[t.source].url} target="_blank" rel="noopener noreferrer">
                              {RESOURCE_BY_ID[t.source].publisher} <span aria-hidden="true">↗</span>
                            </a>
                          </>
                        )}
                      </span>
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </section>

      <p className="suggest">
        Know a primary source that belongs here?{" "}
        <a href={SITE.repoUrl + "/blob/main/CONTRIBUTING.md#adding-a-source"} target="_blank" rel="noopener noreferrer">
          Suggest it on GitHub
        </a>
        .
      </p>
    </div>
  );
}
