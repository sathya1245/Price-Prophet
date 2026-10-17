import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base keeps the build portable across GitHub Pages project sites
// and any other static host.
export default defineConfig({
  base: './',
  plugins: [react()]
})