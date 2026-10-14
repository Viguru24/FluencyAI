import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': '*',
    },
    proxy: {
      '/freellm-gateway': {
        target: 'http://127.0.0.1:31415',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/freellm-gateway/, ''),
      },
      '/v1': {
        target: 'http://127.0.0.1:31415',
        changeOrigin: true,
      },
    },
  },
})
