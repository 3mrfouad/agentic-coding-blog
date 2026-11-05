// Tiny hash router: #/, #/explore, #/library, #/news. Hash routes work on GitHub Pages with no server setup.
import { useEffect, useState } from "react";

export const ROUTES = ["/", "/explore", "/library", "/news"];

function read() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path: ROUTES.includes(path) ? path : "/", params: new URLSearchParams(query) };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

// link to a box in the diagram: opens the explorer focused on it
export const exploreHref = (id) => (id ? `#/explore?focus=${encodeURIComponent(id)}` : "#/explore");
