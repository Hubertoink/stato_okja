import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import packageJson from './package.json';

const appVersion = process.env.VITE_APP_VERSION || packageJson.version;

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          if (normalizedId.includes('/node_modules/recharts/')) {
            return 'vendor-charts';
          }

          if (
            normalizedId.includes('/node_modules/jspdf/') ||
            normalizedId.includes('/node_modules/html2canvas/')
          ) {
            return 'vendor-pdf-export';
          }

          if (
            normalizedId.includes('/node_modules/xlsx/') ||
            normalizedId.includes('/node_modules/xlsx-js-style/')
          ) {
            return 'vendor-excel-export';
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
