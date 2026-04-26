import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages = https://mattt0204.github.io/calendar-app/ → build 시 base path 필수.
// dev (vite) 에선 root '/'.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? '/calendar-app/' : '/',
}))
