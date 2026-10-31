import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'GOOGLE_', 'API_', 'SITE_'],
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Hosteliq',
        short_name: 'Hosteliq',
        description: 'Modern Hostel & Accommodation Management Platform',
        theme_color: '#9333ea',
        background_color: '#ffffff',
        display: 'standalone'
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\/.*/],
        // Exclude heavy isolated bundles from initial PWA precache so they load strictly on demand
        globIgnores: ['**/vendor-three-*.js', '**/vendor-pdf-*.js', '**/vendor-sheets-*.js'],
        runtimeCaching: [
          {
            // Strictly NEVER cache API responses in ServiceWorker CacheStorage
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkOnly',
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('node_modules')) {
            if (
              normalizedId.includes('/react/') ||
              normalizedId.includes('/react-dom/') ||
              normalizedId.includes('/react-router-dom/') ||
              normalizedId.includes('/react-router/')
            ) {
              return 'vendor-react';
            }
            if (normalizedId.includes('three') || normalizedId.includes('@react-three')) {
              return 'vendor-three';
            }
            if (normalizedId.includes('xlsx')) {
              return 'vendor-sheets';
            }
            if (normalizedId.includes('jspdf') || normalizedId.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (normalizedId.includes('recharts')) {
              return 'vendor-charts';
            }
            if (normalizedId.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (normalizedId.includes('socket.io-client')) {
              return 'vendor-socket';
            }
            if (normalizedId.includes('lucide-react') || normalizedId.includes('framer-motion') || normalizedId.includes('@radix-ui')) {
              return 'vendor-ui';
            }
          }
        }
      }
    }
  },
});
