import { defineConfig } from 'vite'

export default defineConfig({
  // relative asset paths so the build works at any URL prefix (GitHub Pages serves from /<repo>/)
  base: './',
})
