import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Versão web (arquivo HTML único): interface + núcleo Rust em WebAssembly.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { "import.meta.env.VITE_WEB_DEMO": JSON.stringify("1") },
  build: { target: "es2021", outDir: "dist-web", assetsInlineLimit: 100000000 },
});
