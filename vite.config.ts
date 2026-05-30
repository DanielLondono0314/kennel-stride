import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// NOTA: se removió el `build.rollupOptions.output.manualChunks` personalizado.
// Separaba React de sus consumidores (react-dom, @radix-ui, recharts…), que usan
// APIs de React (forwardRef, createContext) en tiempo de evaluación de módulo. Al
// quedar en chunks distintos, esos módulos se evaluaban antes de que el chunk de
// `react` (CommonJS) inicializara, produciendo en runtime:
//   "Cannot read properties of undefined (reading 'forwardRef' / '__SECRET_INTERNALS…')".
// El chunking por defecto de Vite/Rollup respeta el grafo real de dependencias y
// el orden de init, así que es correcto. Si más adelante se quiere optimizar el
// caché por vendor, hacerlo con cuidado y PROBANDO en navegador (un build OK no
// detecta este fallo de orden en runtime).
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
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/test-suite.ts", "src/**/*.test.ts"],
    css: false,
  },
}));
