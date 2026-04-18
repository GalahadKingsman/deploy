import { defineConfig } from 'vite';

/** Маркетинговый сайт https://edify.su (отдельно от Telegram webapp). */
export default defineConfig({
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
