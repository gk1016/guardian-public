import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "https://localhost:3411",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "wss://localhost:3411",
        ws: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        // Split node_modules into a long-lived vendor chunk; pages are
        // already split per-route via React.lazy.
        manualChunks: (id) =>
          id.includes("node_modules") ? "vendor" : undefined,
      },
    },
  },
});
