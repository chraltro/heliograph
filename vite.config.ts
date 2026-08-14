import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Two build shapes come out of this config.
//   npm run build            -> dist/, a normal static site with separate assets
//   SINGLEFILE=1 npm run build -> dist/, one self-contained index.html
// The single file variant inlines every asset as a data URI so the app runs from
// disk, from a file server, or from a sandbox that blocks all outbound requests.
const singleFile = process.env.SINGLEFILE === '1'

export default defineConfig({
  base: './',
  plugins: singleFile ? [viteSingleFile()] : [],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: singleFile ? Number.MAX_SAFE_INTEGER : 4096,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
