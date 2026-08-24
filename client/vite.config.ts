import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// We are serving the app under /quiz path on production
const publicUrl = (process.env.PUBLIC_URL ?? '').replace(/^\/+|\/+$/g, '');
const base = publicUrl ? `/${publicUrl}/` : '/';

// https://vite.dev/config/
export default defineConfig({
    base,
    plugins: [react()],
    server: {
        host: true,
        port: 5174,
        proxy: {
            '/api': 'http://localhost:3002',
        },
    },
});
