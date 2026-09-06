import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build working at any GitHub Pages path,
// including a project page like https://user.github.io/neat-tools/
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    // Stamped at build time, shown on the מנטורים page. Makes it possible to
    // tell at a glance which build is actually live, instead of inferring it
    // from whether a change appears to have taken effect.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
})
