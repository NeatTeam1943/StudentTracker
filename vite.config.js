import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build working at any GitHub Pages path,
// including a project page like https://user.github.io/neat-tools/
export default defineConfig({
  plugins: [react()],
  base: './',
})
