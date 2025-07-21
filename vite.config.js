// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-redirects',
      closeBundle() {
        const from = 'public/_redirects';
        const to = 'dist/_redirects';
        if (existsSync(from)) {
          try {
            copyFileSync(from, to);
            console.log('✅ _redirects copied to dist/');
          } catch (err) {
            console.warn('⚠️ Failed to copy _redirects:', err.message);
          }
        } else {
          console.warn('⚠️ public/_redirects not found');
        }
      },
    },
  ],
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
  },
});

