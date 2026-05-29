import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Mobile-first SPA, deployed at the root of a CloudFront distribution.
// All client-side routes resolve to the same index.html (CloudFront's
// 403/404 -> /index.html rule in cloudfront.tf handles the fallback for
// deep links / refreshes).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
  server: {
    port: 5173,
  },
});
