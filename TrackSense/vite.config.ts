import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_URL: string = "http://localhost:3000"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { //proxy for session auth with passport to work
      '/api/login': {
        target: `${API_URL}/login`,
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/login/, ''),
      },
      '/api/expenses': {
        target: `${API_URL}/expenses`,
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/expenses/, ''),
      },
      '/api/expenses/add': {
        target: `${API_URL}/expenses/add`,
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/expenses\/add/, ''),
      },
      '/api/expenses/.*': {
        target: `${API_URL}/expenses`,
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/expenses/, ''),
      }
    }
  }
})
