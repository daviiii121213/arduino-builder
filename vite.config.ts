import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // saída só com caracteres ASCII: assim o jogo não depende da codificação
  // declarada pela página que o hospeda (ele é publicado em linha, num quadro)
  esbuild: {
    charset: 'ascii',
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: true,
    port: 5173,
  },
});
