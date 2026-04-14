import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Any request to /api/... is forwarded to Express on port 3000
      // This means React never needs to worry about CORS
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: '../public',   // Express serves this as static files
    emptyOutDir: true,
  },
});