import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
    esbuild: {
    drop: ["console", "debugger"],
  },
} as UserConfig)
