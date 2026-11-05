// One theme for every page: System, Light or Dark, remembered in this browser.
import { useEffect, useState } from "react";

const KEY = "cafl-theme";
export const THEMES = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function readTheme() {
  try {
    return localStorage.getItem(KEY) || "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable; the theme still applies for this visit */
    }
  }, [theme]);
  return [theme, setTheme];
}
