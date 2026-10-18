import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/stellar-lens/",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
