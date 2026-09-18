import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiTarget = process.env.FC27_API_URL ?? 'http://127.0.0.1:8787'

// Su GitHub Pages il sito non sta nella radice del dominio ma in
// /nome-repo/: il workflow passa quel percorso come VITE_BASE.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
