import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    root: resolve(__dirname, 'src/renderer'),
    plugins: [vue()],
    resolve: {
        alias: {
            '@renderer': resolve(__dirname, 'src/renderer/src')
        }
    },
    server: {
        port: 1420,
        strictPort: true
    },
    build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true
    }
})
