import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The API runs on :4000. Proxying /api keeps the refresh-token cookie same-origin in dev.
export default defineConfig({
  plugins: [react()],
  // '@/…' is the shadcn alias, used by the vendored React Bits components.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:4000', ws: true },
    },
  },
  build: { target: 'es2020', sourcemap: true },
});
