import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'fs'

const buildVersion = Date.now().toString()

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'version-file',
      apply: 'build' as const,
      buildStart() {
        writeFileSync('public/version.json', JSON.stringify({ v: buildVersion }))
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  base: process.env.VITE_BASE_PATH || '/',
})
