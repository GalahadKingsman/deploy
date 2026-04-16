/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const DEV_ALLOWED_HOSTS = ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok-free.de'];

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    ...(mode === 'development' ? { allowedHosts: DEV_ALLOWED_HOSTS } : {}),
    // Proxy API to avoid mixed content (HTTPS page → HTTP API) when opening via ngrok
    proxy:
      mode === 'development'
        ? {
            '/auth': { target: 'http://localhost:3001', changeOrigin: true },
            '/me': { target: 'http://localhost:3001', changeOrigin: true },
            '/health': { target: 'http://localhost:3001', changeOrigin: true },
            '/admin': { target: 'http://localhost:3001', changeOrigin: true },
            '/experts': { target: 'http://localhost:3001', changeOrigin: true },
            '/library': { target: 'http://localhost:3001', changeOrigin: true },
            '/learn': { target: 'http://localhost:3001', changeOrigin: true },
            '/courses': { target: 'http://localhost:3001', changeOrigin: true },
            '/lessons': { target: 'http://localhost:3001', changeOrigin: true },
            '/invites': { target: 'http://localhost:3001', changeOrigin: true },
            '/topics': { target: 'http://localhost:3001', changeOrigin: true },
          }
        : undefined,
  },
  resolve: {
    alias: {
      // Must use compiled dist: shared/src mixes .ts and emitted .js; Vite would resolve the
      // wrong entry and break (e.g. env/index.js → missing validate.js). Run shared build first.
      '@tracked/shared': resolve(__dirname, '../../packages/shared/dist/index.js'),
    },
  },
  optimizeDeps: {
    include: ['@tracked/shared'],
  },
  build: {
    commonjsOptions: {
      include: [/shared/, /node_modules/],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: true,
  },
}));
