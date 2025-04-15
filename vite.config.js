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
