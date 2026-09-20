import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/image': 'http://localhost:8466',
      '/images': 'http://localhost:8466',
      '/thumbnails': 'http://localhost:8466',
      '/accounts': 'http://localhost:8466',
      '/api': 'http://localhost:8466',
      '/ws': {
        target: 'ws://localhost:8466',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
