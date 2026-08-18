import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  base: '/',
  publicDir: 'public-local',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: process.env.PROMARKIA_LOCAL_API || 'http://127.0.0.1:8877',
        ws: true,
      },
      '/files': {
        target: process.env.PROMARKIA_LOCAL_API || 'http://127.0.0.1:8877',
      },
    },
  },
  plugins: [
    react(),
    process.env.ANALYZE
      ? visualizer({ filename: 'bundle-stats.json', template: 'raw-data', gzipSize: true })
      : null,
  ].filter(Boolean),
  resolve: {
    alias: {
      react: path.resolve('./node_modules/react'),
      'firebase/app': path.resolve('./src/local/firebaseCompat/app.js'),
      'firebase/auth': path.resolve('./src/local/firebaseCompat/auth.js'),
      'firebase/firestore': path.resolve('./src/local/firebaseCompat/firestore.js'),
      'firebase/functions': path.resolve('./src/local/firebaseCompat/functions.js'),
      'firebase/storage': path.resolve('./src/local/firebaseCompat/storage.js'),
      'firebase/analytics': path.resolve('./src/local/firebaseCompat/analytics.js'),
    },
  },
  // Route-level lazy imports provide most split points. Keep React in one
  // explicit foundational chunk; dependency-specific function splitting can
  // create circular chunks (notably with react-i18next) and break startup.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(moduleId)) return 'react-vendor';
          if (moduleId.includes('/node_modules/sweetalert2/')) return 'alerts-vendor';
          if (moduleId.includes('/node_modules/highlight.js/')) return 'syntax-vendor';
          if (/\/node_modules\/(react-markdown|remark-|rehype-|hast-|mdast-|micromark|unist-|parse5|entities|property-information|space-separated-tokens|comma-separated-tokens|web-namespaces|vfile|bail|trough|devlop)\//.test(moduleId)) {
            return 'markdown-vendor';
          }
          return undefined;
        },
      },
    },
  },
  logLevel: 'info',
});
