import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 34115,
    strictPort: true,
  },
});
