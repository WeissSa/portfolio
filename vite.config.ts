import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { staticMirrorPlugin } from './scripts/static-mirror';

export default defineConfig({
  base: '/portfolio/',
  plugins: [react(), staticMirrorPlugin()],
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    css: false,
  },
});
