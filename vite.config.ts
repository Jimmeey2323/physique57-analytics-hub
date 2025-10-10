import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react({
      jsxImportSource: 'react'
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Ensure React is available globally for forwardRef
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      external: (id) => {
        // Don't externalize any dependencies - bundle them all
        return false;
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Move recharts to vendor chunk to avoid circular dependency issues
            // Keep core libraries (React, recharts, lucide-react) together
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'utils-vendor';
            }
            if (id.includes('@tanstack')) {
              return 'query-vendor';
            }
            // Keep React, React-DOM, React Router, recharts, lucide-react, framer-motion, and Radix UI together in vendor chunk
            // This prevents React import resolution issues and circular dependencies
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            return 'vendor';
          }
          
          if (id.includes('/components/dashboard/')) {
            return 'dashboard';
          }
          
          if (id.includes('/components/ui/')) {
            return 'ui-components';
          }
          
          if (id.includes('/pages/')) {
            return 'pages';
          }
          
          if (id.includes('/hooks/') || id.includes('/utils/')) {
            return 'utils';
          }
        },
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name || 'chunk';
          return `assets/${name}-[hash].js`;
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: true,
    target: 'es2015',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-router-dom',
      'recharts',
      'date-fns',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      '@radix-ui/react-tabs',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      '@tanstack/react-query'
    ],
    exclude: [],
    force: true,
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    treeShaking: true,
  }
}));
}));
