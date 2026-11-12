import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API runs on :4000. Proxying /api keeps the refresh-token cookie same-origin in dev.
export default defineConfig({
  plugins: [react()],
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
