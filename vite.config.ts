import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Isolate Leaflet + clustering into their own async chunk so the
          // main bundle stays lean for users who never visit /map
          "vendor-leaflet": ["leaflet", "react-leaflet", "react-leaflet-cluster"],
          "vendor-react": ["react", "react-dom"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
}));
