import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

/** Маркетинговый сайт https://edify.su (отдельно от Telegram webapp). */
export default defineConfig({
  root,
  server: {
    port: 5174,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 5174,
    host: true,
  },
});
