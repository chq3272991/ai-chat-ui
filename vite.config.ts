import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',  // 后端服务地址
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')  // http://localhost:5174/api/vector/chat 等于访问 http://localhost:8080/vector/chat
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
