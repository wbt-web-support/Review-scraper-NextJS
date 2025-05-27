import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';
import alias from '@rollup/plugin-alias';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../', import.meta.url)), // points @ to your project root
    },
  },
  define: {
    'process.env': {}, // Polyfill for browser
  },
  build: {
    lib: {
      entry: 'embed-entry.tsx',
      name: 'ReviewHubWidget',
      fileName: 'reviewhub-widget',
      formats: ['umd'],
    },
    rollupOptions: {
      plugins: [
        alias({
          entries: [
            { find: '@', replacement: fileURLToPath(new URL('../', import.meta.url)) }
          ]
        })
      ],
      external: [],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    outDir: '../public/embed-dist', // Output to public/embed-dist for easy serving
    emptyOutDir: true,
  },
}); 