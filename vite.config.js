// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // or whatever you're using
  },
  build: {
    outDir: 'dist',
  },
});
