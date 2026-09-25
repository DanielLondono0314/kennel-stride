import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Node 25+ trae un `localStorage` global propio que, sin --localstorage-file,
// vale `undefined` y tapa el de jsdom (rompe DogModal y todo lo que use
// localStorage en tests). Se desactiva solo en versiones que conocen el flag.
const WEBSTORAGE_FLAG = "--no-experimental-webstorage";
const nodeExecArgv = process.allowedNodeEnvironmentFlags.has(WEBSTORAGE_FLAG) ? [WEBSTORAGE_FLAG] : [];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/test-suite.ts", "tests/**/*.test.{ts,tsx}"],
    css: false,
    pool: "forks",
    poolOptions: {
      forks: { execArgv: nodeExecArgv },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
