import React from "react";
import { createRoot } from "react-dom/client";
// Order matters: React Flow's defaults first, then the theme, so the theme's colours win.
// Both load here, once, for every page.
import "@xyflow/react/dist/style.css";
import "./styles.css";
import Root from "./site/Root.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
