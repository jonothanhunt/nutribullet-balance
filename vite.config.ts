import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works from any path: GitHub Pages serves it
// under /nutribullet-balance/, a custom domain serves it at the root.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
