import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ЗАМЕНИ "your-repo-name" на название своего GitHub репозитория!
export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/',
})
