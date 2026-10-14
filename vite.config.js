import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const release = JSON.parse(readFileSync(resolve(__dirname, 'release.json'), 'utf8'));
if (!/^\d{4}\.\d{2}\.\d{2}-\d{2,}$/.test(release.version)) throw new Error('Invalid release.json version');

export default defineConfig({
  plugins: [{
    name: 'refcare-release',
    transformIndexHtml(html) {
      return {
        html: html.replace(/src="supabase-config\.js"/g, `src="supabase-config.js?v=${release.version}"`),
        tags: [{ tag: 'meta', attrs: { name: 'refcare-version', content: release.version }, injectTo: 'head' }],
      };
    },
  }],
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
        facility: resolve(__dirname, 'facility.html'),
        mobile: resolve(__dirname, 'mobile.html')
      }
    }
  }
});

