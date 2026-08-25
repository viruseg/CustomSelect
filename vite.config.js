import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        dts({
            entryRoot: 'src',
            include: ['src/**/*.js'],
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: 'src/index.js',
            formats: ['es'],
            fileName: 'index',
        },
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                assetFileNames: (assetInfo) =>
                    assetInfo.names?.[0]?.endsWith('.css') ? 'index.css' : '[name][extname]',
            },
        },
    },
});
