import { defineConfig } from "vite";

export default defineConfig({
  root: "site",
  base: "./",
  server: { port: 8000 },
  preview: { port: 8000 },
  build: { outDir: "../dist", emptyOutDir: true },
});
