/**
 * Taking a picture of the map.
 *
 * The scene lives on two canvases, a WebGL one and a 2D one, so an export has
 * to composite them in the same order the screen does and then add the one
 * thing the screen does not need: a caption saying what instant is being
 * looked at, because a picture of a terminator with no date on it means
 * nothing once it leaves the page.
 */

import { INK, SUN } from '../render/palette.ts'

export interface ExportCaption {
  /** "SUN 21 JUN 2026", already formatted. */
  date: string
  time: string
  zone: string
  place: string
}

const BAR_HEIGHT = 54

/**
 * Compose the two canvases and the caption into one image.
 *
 * The WebGL canvas is read at its own device resolution rather than the CSS
 * one, so the export is as sharp as the screen was; the overlay is scaled to
 * match. Both are drawn with no smoothing between them, because they are
 * already the same size and any resampling would soften the hairlines the
 * overlay exists to draw.
 */
export async function composeImage(
  map: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  caption: ExportCaption,
): Promise<Blob> {
  const width = map.width
  const height = map.height
  const scale = width / Math.max(1, map.clientWidth)

  const out = document.createElement('canvas')
  out.width = width
  out.height = height + Math.round(BAR_HEIGHT * scale)
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('could not get a 2D context to export into')

  ctx.fillStyle = INK[0]
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(map, 0, 0, width, height)
  ctx.drawImage(overlay, 0, 0, width, height)

  // The caption bar, laid out in device pixels so it matches the map's density.
  const pad = 18 * scale
  const baseline = height + BAR_HEIGHT * scale * 0.5
  ctx.textBaseline = 'middle'

  ctx.fillStyle = INK[800]
  ctx.font = `500 ${13 * scale}px Archivo, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(caption.place, pad, baseline)

  ctx.fillStyle = INK[500]
  ctx.font = `${11 * scale}px 'Martian Mono', ui-monospace, monospace`
  ctx.textAlign = 'right'
  ctx.fillText(`${caption.date}  ${caption.time}  ${caption.zone}`, out.width - pad, baseline)

  // The mark, so a picture that travels says where it came from.
  ctx.textAlign = 'center'
  ctx.fillStyle = SUN[400]
  ctx.font = `500 ${12 * scale}px Archivo, system-ui, sans-serif`
  ctx.fillText('Heliograph', out.width / 2, baseline)

  return new Promise((resolve, reject) => {
    out.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('the browser would not encode the image'))
    }, 'image/png')
  })
}

/**
 * Hand the image to whatever the platform has: the share sheet on a phone, a
 * download everywhere else. Sharing is tried first because on a phone a
 * downloaded file is close to unreachable, and refused silently if the user
 * dismisses the sheet, which is not an error.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Heliograph' })
      return 'shared'
    } catch (error) {
      // AbortError means the sheet was dismissed, which is not a failure worth
      // falling back on: the viewer said no.
      if (error instanceof Error && error.name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

/** Copy the current address to the clipboard, falling back to a selection. */
export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    try {
      const field = document.createElement('textarea')
      field.value = url
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.append(field)
      field.select()
      const ok = document.execCommand('copy')
      field.remove()
      return ok
    } catch {
      return false
    }
  }
}
