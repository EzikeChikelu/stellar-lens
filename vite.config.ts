import { defineConfig } from "vitest/config";

export default defineConfig({
  // Netlify serves this app from the domain root.
  base: "/",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
