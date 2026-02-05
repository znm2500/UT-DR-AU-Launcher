import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // 将 7zip-bin 和 node-7z 排除在打包之外
        external: ['7zip-bin', 'node-7z']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        // 如果预加载脚本没用这些库，可以不写
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()]
  }
})