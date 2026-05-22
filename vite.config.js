import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        facility: resolve(__dirname, 'facility.html')
      }
    }
  }
});

