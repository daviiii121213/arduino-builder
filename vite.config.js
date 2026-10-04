import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Rapier ships its WebAssembly inlined, which makes the bundle large by design.
    chunkSizeWarningLimit: 6000,
  },
});
