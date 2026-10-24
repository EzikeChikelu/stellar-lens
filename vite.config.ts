import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serves this project under /stellar-lens/.
  // Vercel, Netlify, and local development serve from the domain root.
  base: process.env.GITHUB_ACTIONS === "true" ? "/stellar-lens/" : "/",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
