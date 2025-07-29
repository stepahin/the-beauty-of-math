import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// Generate SVG list at build time
const svgDir = path.resolve(__dirname, 'mathworld_svgs')
let svgFiles = []
if (fs.existsSync(svgDir)) {
  svgFiles = fs.readdirSync(svgDir)
    .filter(file => file.endsWith('.svg'))
    .sort()
}

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/the-beauty-of-math/' : '/',
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.svg')) {
            return 'mathworld_svgs/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  },
  publicDir: 'public',
  define: {
    '__SVG_FILES__': JSON.stringify(svgFiles)
  }
})