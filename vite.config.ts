import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'fs'

const buildVersion = Date.now().toString()

// 確保 base 結尾一定有斜線（否則 BASE_URL 拼接會少一個斜線，導致 sw.js / version.json 404）
const rawBase = process.env.VITE_BASE_PATH || '/'
const normalizedBase = rawBase.endsWith('/') ? rawBase : rawBase + '/'

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
  base: normalizedBase,
})
