import { lazy, Suspense } from "react";
import { useRoute } from "./routing.js";
import { useTheme } from "./theme.js";
import { SiteHeader, SiteFooter } from "./SiteHeader.jsx";
import Landing from "../pages/Landing.jsx";
import Library from "../pages/Library.jsx";
import News from "../pages/News.jsx";
import "../site.css";

// the explorer pulls in the layout engine, so it loads only when someone opens it
const Explorer = lazy(() => import("../App.jsx"));

export default function Root() {
  const { path, params } = useRoute();
  const [theme, setTheme] = useTheme();

  if (path === "/explore") {
    // the explorer gets the same header as every page: home, navigation, theme and GitHub
    return (
      <div className="explorer-page site">
        <SiteHeader path={path} theme={theme} setTheme={setTheme} compact />
        <Suspense fallback={<div className="loading">Loading the diagram…</div>}>
          <Explorer key={params.toString()} focus={params.get("focus")} />
        </Suspense>
      </div>
    );
  }

  const Page = path === "/library" ? Library : path === "/news" ? News : Landing;
  return (
    <div className="site">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>
        Skip to content
      </a>
      <SiteHeader path={path} theme={theme} setTheme={setTheme} />
      <main id="main" tabIndex={-1}>
        <Page params={params} />
      </main>
      <SiteFooter />
    </div>
  );
}
