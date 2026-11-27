import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['apple-touch-icon.png', 'icons/logo.svg'],
      manifest: {
        name: 'ELCO – מעבדה לבדיקות גילוי וכיבוי אש',
        short_name: 'ELCO',
        id: '/',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#f2f2f7',
        background_color: '#f2f2f7',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // admin only; others land on home
        shortcuts: [
          { name: 'עבודה חדשה', url: '/admin/jobs/new', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'יומן', url: '/admin/calendar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2,webmanifest}'],
      },
    }),
  ],
  server: { port: 5173 },
});
