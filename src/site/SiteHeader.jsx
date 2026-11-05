import { SITE } from "../data/index.js";
import { THEMES } from "./theme.js";

const NAV = [
  { path: "/explore", label: "Explore" },
  { path: "/library", label: "Library" },
  { path: "/news", label: "News" },
];

// GitHub's mark (Octicons, MIT licensed)
export function GitHubIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" focusable="false" className="gh-icon">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export function ThemeSwitch({ theme, setTheme }) {
  return (
    <div className="theme" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          className={"seg" + (theme === t.id ? " on" : "")}
          onClick={() => setTheme(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SiteHeader({ path, theme, setTheme, compact = false }) {
  return (
    <header className={"site-header" + (compact ? " compact" : "")}>
      <div className="site-wrap site-header-row">
        <a className="site-brand" href="#/">
          {SITE.title}
        </a>
        <nav className="site-nav" aria-label="Site">
          {NAV.map((n) => (
            <a key={n.path} href={"#" + n.path} aria-current={path === n.path ? "page" : undefined}>
              {n.label}
            </a>
          ))}
          <a className="gh-link" href={SITE.repoUrl} target="_blank" rel="noopener noreferrer">
            <GitHubIcon /> GitHub
          </a>
        </nav>
        <ThemeSwitch theme={theme} setTheme={setTheme} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-wrap site-footer-row">
        <span>
          Open source under the {SITE.license} license.{" "}
          <a className="gh-link" href={SITE.repoUrl} target="_blank" rel="noopener noreferrer">
            <GitHubIcon size={14} /> Source on GitHub
          </a>
          {" · "}
          <a href={SITE.repoUrl + "/blob/main/CONTRIBUTING.md"} target="_blank" rel="noopener noreferrer">
            Contribute
          </a>
        </span>
        <span>
          <a href="#/explore">Explore</a> · <a href="#/library">Library</a> · <a href="#/news">News</a>
        </span>
      </div>
    </footer>
  );
}
