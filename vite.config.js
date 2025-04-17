import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Add any path aliases you might need here
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure proper chunk naming for better caching
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        // Ensure ESM format
        format: "es",
      },
    },
    // Ensure source maps are created
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
    // Allow proper hot module replacement
    hmr: {
      overlay: true,
    },
  },
  // Ensure CSS is properly handled
  css: {
    devSourcemap: true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["react-image-crop"],
  },
});
