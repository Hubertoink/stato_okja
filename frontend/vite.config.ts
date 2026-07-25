import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import packageJson from './package.json';

const appVersion = process.env.VITE_APP_VERSION || packageJson.version;
const MANUAL_CHUNK_RULES: Array<{ match: string; chunk: string }> = [
  { match: '/node_modules/recharts/', chunk: 'vendor-charts' },
  { match: '/node_modules/jspdf/', chunk: 'vendor-jspdf' },
  { match: '/node_modules/html2canvas/', chunk: 'vendor-html2canvas' },
  { match: '/node_modules/xlsx-js-style/', chunk: 'vendor-xlsx-style' },
  { match: '/node_modules/xlsx/', chunk: 'vendor-xlsx-core' },
  { match: '/node_modules/codepage/', chunk: 'vendor-xlsx-codepage' },
  { match: '/node_modules/cfb/', chunk: 'vendor-xlsx-cfb' },
  { match: '/node_modules/ssf/', chunk: 'vendor-xlsx-ssf' },
];

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          for (const rule of MANUAL_CHUNK_RULES) {
            if (normalizedId.includes(rule.match)) {
              return rule.chunk;
            }
          }

          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Public QR links must always receive the current app shell from the
      // network. Otherwise an older cached shell can miss the public route and
      // render the login screen once before its service worker updates.
      workbox: {
        navigateFallbackDenylist: [/^\/survey\//],
      },
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Stato 1.0 - OKJA Statistik',
        short_name: 'Stato',
        description: 'Statistik- und Dokumentationssystem für offene Kinder- und Jugendarbeit',
        theme_color: '#5B6CFF',
        background_color: '#FAFBFF',
        display: 'standalone',
        icons: [
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/external/openholidaysapi': {
        target: 'https://openholidaysapi.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/external\/openholidaysapi/, ''),
      },
    },
  },
});
