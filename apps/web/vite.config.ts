import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the site works under GitHub Pages' /twig-app/ path.
  base: './',
  plugins: [react(), tailwindcss()],
})
