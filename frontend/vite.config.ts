import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// PWA : le manifest est statique (public/manifest.webmanifest) + icônes pwa-*.png,
// lié dans index.html. vite-plugin-pwa retiré (config obsolète qui référençait
// une icône inexistante et entrait en collision avec le manifest statique).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['growmanager', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      // Health check utilisé par l'app mobile (test de connexion serveur)
      '/health': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    }
  }
})
