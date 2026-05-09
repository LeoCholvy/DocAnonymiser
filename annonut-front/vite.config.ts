import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Toutes les requêtes /api et /login partent vers FastAPI
      '/api': 'http://localhost:8000',
      '/login': 'http://localhost:8000',
      '/oauth2callback': 'http://localhost:8000'
    }
  }
})