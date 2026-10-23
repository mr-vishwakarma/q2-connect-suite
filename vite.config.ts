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
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) {
              return 'vendor-three';
            }
            if (id.includes('xlsx')) {
              return 'vendor-sheets';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('socket.io-client')) {
              return 'vendor-socket';
            }
            if (id.includes('lucide-react') || id.includes('framer-motion') || id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router-dom/') ||
              id.includes('/react-router/')
            ) {
              return 'vendor-react';
            }
          }
        }
      }
    }
  },
});
