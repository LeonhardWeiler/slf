/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Force a single copy of React so dependencies (e.g. Radix/shadcn
    // components) never get a second, dispatcher-less React instance.
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // The current suite is pure logic (validation + Zod parsing); no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        // CI runs on oven/bun (no node), so vitest executes under the bun
        // runtime. Externalized zod resolves there with an undefined `z` export
        // (ESM/CJS interop). Inlining lets vitest transform zod itself, so the
        // named export works regardless of the runtime.
        inline: ["zod"],
      },
    },
  },
});
