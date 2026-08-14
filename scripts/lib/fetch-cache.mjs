import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const CACHE_DIR = join(HERE, '..', '.cache')

/**
 * Download a URL once and reuse the copy on disk for every later run.
 * The Natural Earth files are tens of megabytes in total, so the pipeline stays
 * usable offline after the first successful run.
 */
export async function cached(url, name) {
  await mkdir(CACHE_DIR, { recursive: true })
  const path = join(CACHE_DIR, name)
  try {
    const info = await stat(path)
    if (info.size > 0) return path
  } catch {
    // Not downloaded yet.
  }
  process.stdout.write(`  fetching ${name} ... `)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} responded ${res.status}`)
  const body = Buffer.from(await res.arrayBuffer())
  await writeFile(path, body)
  process.stdout.write(`${(body.length / 1e6).toFixed(1)} MB\n`)
  return path
}

export async function cachedJson(url, name) {
  return JSON.parse(await readFile(await cached(url, name), 'utf8'))
}

export const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
