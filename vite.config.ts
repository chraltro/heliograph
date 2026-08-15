import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { build as esbuild } from 'esbuild'
import { createHash } from 'node:crypto'

// Two build shapes come out of this config.
//   npm run build            -> dist/, a normal static site with separate assets
//   SINGLEFILE=1 npm run build -> dist/, one self-contained index.html
// The single file variant inlines every asset as a data URI so the app runs from
// disk, from a file server, or from a sandbox that blocks all outbound requests.
const singleFile = process.env.SINGLEFILE === '1'

/**
 * Compile the service worker once the rest of the build is known, so it can
 * precache the exact filenames that were emitted.
 *
 * The single file build has nothing to precache and no separate worker to
 * serve, so it is skipped there entirely: that variant is already one document
 * that runs from a disk with no network at all.
 */
function serviceWorker(): Plugin {
  return {
    name: 'heliograph-service-worker',
    apply: 'build',
    async generateBundle(_options, bundle) {
      if (singleFile) return
      const assets = Object.keys(bundle).map((name) => `./${name}`)
      const precache = ['./', './index.html', ...assets, './manifest.webmanifest']
      // The cache name has to change whenever any asset does, and the asset
      // names are already content hashed, so hashing the list is enough.
      const build = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12)
      const result = await esbuild({
        entryPoints: [new URL('./src/sw.ts', import.meta.url).pathname],
        bundle: true,
        format: 'iife',
        target: 'es2022',
        write: false,
        define: {
          __PRECACHE__: JSON.stringify(precache),
          __BUILD__: JSON.stringify(build),
        },
      })
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: result.outputFiles[0]!.text })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: singleFile ? [viteSingleFile()] : [serviceWorker()],
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
