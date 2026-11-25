import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { staticMirrorPlugin } from './scripts/static-mirror';

export default defineConfig({
  base: '/portfolio/',
  plugins: [react(), staticMirrorPlugin()],
  resolve: {
    alias: {
      // Node 21 cannot require() the ESM-only three build. The @react-three
      // packages ship no "exports" map, so node/vite fall back to their CJS
      // `main` entries, whose `require('three')` resolves to three.cjs and
      // throws ERR_REQUIRE_ESM on Node 21 (CI's Node 22 tolerates it). Pin the
      // ESM dist entries so the whole chain stays ESM; three then resolves via
      // its `import` condition. Production builds never import the test
      // renderer, and already prefer these ESM entries.
      '@react-three/test-renderer':
        '@react-three/test-renderer/dist/react-three-test-renderer.esm.js',
      '@react-three/fiber': '@react-three/fiber/dist/react-three-fiber.esm.js',
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // NOTE: no global testTimeout. The one slow axe scan extends its own limit
    // locally (tests/axe.test.tsx); a global 15s would mask real hangs.
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    css: false,
  },
});
