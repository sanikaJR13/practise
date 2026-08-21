import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/712': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/api/8a': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/api/igr': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/api/v1': {
        target: 'http://localhost:8000/api/igr',
        changeOrigin: true,
        secure: false
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
