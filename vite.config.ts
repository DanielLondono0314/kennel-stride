import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // recharts + d3 internals — siempre en su propio chunk
          if (id.includes("recharts") || id.includes("victory-vendor")) {
            return "vendor-charts";
          }
          // radix-ui — muchos paquetes, separarlos del bundle principal
          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }
          // supabase client
          if (id.includes("@supabase")) {
            return "vendor-supabase";
          }
          // react-query devtools (solo dev, pero mejor separado)
          if (id.includes("@tanstack/react-query-devtools")) {
            return "vendor-devtools";
          }
          // react core + router — pequeño, pero separarlo evita re-descarga
          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("scheduler")
          ) {
            return "vendor-react";
          }
          // todo lo demás de node_modules va a vendor genérico
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/test-suite.ts", "src/**/*.test.ts"],
    css: false,
  },
}));
