import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from the root of a custom domain (agenticcoding.blog), so assets use absolute
// paths. If you deploy to a GitHub Pages *project* page instead
// (https://OWNER.github.io/REPO/), change base to "/REPO/".
export default defineConfig({
  base: "/",
  plugins: [react()],
});
