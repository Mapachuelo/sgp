import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
      '/ws': { target: process.env.VITE_PROXY_TARGET?.replace('http', 'ws') || 'ws://localhost:3000', ws: true },
    },
  },
});
