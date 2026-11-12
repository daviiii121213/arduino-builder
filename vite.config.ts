import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração do frontend. Todos os recursos são empacotados localmente:
// nenhuma fonte, imagem ou script é carregado da internet em tempo de execução.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: "127.0.0.1" },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: "es2021",
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
} as never);
