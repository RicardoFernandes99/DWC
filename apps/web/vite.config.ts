import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), [
    'API_PORT',
    'API_PROXY_TARGET',
    'WEB_USE_POLLING',
  ]);
  // The Compose stack points the proxy at the api service.
  const api =
    env.API_PROXY_TARGET || `http://127.0.0.1:${env.API_PORT || 3000}`;
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Windows bind mounts do not deliver file events into containers.
      watch: env.WEB_USE_POLLING === 'true' ? { usePolling: true } : undefined,
      proxy: {
        '/api': { target: api, ws: true },
        '/socket.io': { target: api, ws: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
