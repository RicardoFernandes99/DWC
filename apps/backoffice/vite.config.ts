import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Builds public/build/app.css and app.js with fixed names; the Blade layout
// links them directly (no manifest or Laravel Vite plugin).
export default defineConfig({
    plugins: [tailwindcss()],
    publicDir: false,
    build: {
        outDir: 'public/build',
        emptyOutDir: true,
        cssCodeSplit: false,
        rollupOptions: {
            input: { app: 'resources/js/app.js' },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: (asset) =>
                    asset.names.some((name) => name.endsWith('.css'))
                        ? 'app.css'
                        : '[name][extname]',
            },
        },
    },
});
