var _a, _b;
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@components': resolve(__dirname, './src/components'),
            '@pages': resolve(__dirname, './src/pages'),
            '@hooks': resolve(__dirname, './src/hooks'),
            '@stores': resolve(__dirname, './src/stores'),
            '@utils': resolve(__dirname, './src/utils'),
            '@types': resolve(__dirname, './src/types'),
            '@api': resolve(__dirname, './src/api'),
        },
    },
    server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: (_a = process.env['VITE_API_URL']) !== null && _a !== void 0 ? _a : 'http://localhost:3001',
                changeOrigin: true,
                rewrite: function (path) { return path; },
            },
            '/ws': {
                target: (_b = process.env['VITE_WS_URL']) !== null && _b !== void 0 ? _b : 'ws://localhost:3001',
                ws: true,
            },
        },
        hmr: { port: 5173 },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom'],
                    router: ['react-router-dom'],
                    charts: ['recharts'],
                    motion: ['framer-motion'],
                    icons: ['lucide-react'],
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'src/test/', '**/*.d.ts'],
        },
    },
});
