import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/icon-32.png', 'icons/apple-touch-icon.png'],
    manifest: {
      name: 'STM | Currency & Profit Calculator', short_name: 'STM',
      description: 'Currency conversion and profit markup calculator for Egyptian pound selling prices.',
      start_url: './', scope: './', display: 'standalone',
      background_color: '#FFF9F6', theme_color: '#1150DF',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
      runtimeCaching: [] },
  })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
