import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    watch: {
      // Ignore .env files to prevent restart loop on Windows
      ignored: ['**/.env', '**/.env.*'],
    },
  },
});
