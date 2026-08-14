/**
 * The map view: an equirectangular plate that can be panned and zoomed.
 *
 * Every conversion between degrees and pixels lives here, and the same maths is
 * mirrored in GLSL inside the shaders. Coordinates are CSS pixels relative to the
 * map element; the renderer multiplies by the device pixel ratio itself.
 */

export interface View {
  /** Longitude at the centre of the viewport, degrees east. */
  centerLon: number
  /** Latitude at the centre of the viewport, degrees north. */
  centerLat: number
  /** 1 shows the whole world. Larger values move in. */
  zoom: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 12

export interface Size {
  width: number
  height: number
}

/** Pixel width of the full 360 degrees at zoom 1, so the world always fits. */
export function fitWidth(size: Size): number {
  return Math.min(size.width, size.height * 2)
}

export function worldWidth(size: Size, view: View): number {
  return fitWidth(size) * view.zoom
}

export function worldHeight(size: Size, view: View): number {
  return worldWidth(size, view) / 2
}

/** Longitude degrees covered by one pixel. */
export function degreesPerPixel(size: Size, view: View): number {
  return 360 / worldWidth(size, view)
}

export function project(size: Size, view: View, lon: number, lat: number): [number, number] {
  const w = worldWidth(size, view)
  let dLon = lon - view.centerLon
  // Take the shorter way round so geometry near the seam lands on screen.
  dLon = ((((dLon + 180) % 360) + 360) % 360) - 180
  return [(dLon / 360) * w + size.width / 2, (-(lat - view.centerLat) / 180) * (w / 2) + size.height / 2]
}

export function unproject(size: Size, view: View, x: number, y: number): [number, number] {
  const w = worldWidth(size, view)
  const lon = ((x - size.width / 2) / w) * 360 + view.centerLon
  const lat = ((-(y - size.height / 2) / (w / 2)) * 180) + view.centerLat
  return [wrapLongitude(lon), lat]
}

export function wrapLongitude(lon: number): number {
  const r = ((((lon + 180) % 360) + 360) % 360) - 180
  // Keep the antimeridian as +180 rather than -180 so labels read consistently.
  return r === -180 ? 180 : r
}

/** Is this latitude on the plate at all? Off-plate pixels show the surround. */
export function withinPlate(lat: number): boolean {
  return lat >= -90 && lat <= 90
}

/**
 * Keep the view legal: zoom inside its range, and never scroll past a pole.
 * When the plate is shorter than the viewport it stays vertically centred.
 */
export function clampView(size: Size, view: View): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom))
  const clamped: View = { centerLon: wrapLongitude(view.centerLon), centerLat: view.centerLat, zoom }
  const h = worldHeight(size, clamped)
  if (h <= size.height) {
    clamped.centerLat = 0
  } else {
    const halfSpan = (size.height / 2 / h) * 180
    clamped.centerLat = Math.min(90 - halfSpan, Math.max(-90 + halfSpan, clamped.centerLat))
  }
  return clamped
}

/** Zoom about a fixed screen point, the way a trackpad pinch should behave. */
export function zoomAt(size: Size, view: View, anchorX: number, anchorY: number, factor: number): View {
  const [lon, lat] = unproject(size, view, anchorX, anchorY)
  const next: View = { ...view, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor)) }
  const [x, y] = project(size, next, lon, lat)
  const moved: View = {
    centerLon: next.centerLon + ((x - anchorX) / worldWidth(size, next)) * 360,
    centerLat: next.centerLat - ((y - anchorY) / worldHeight(size, next)) * 180,
    zoom: next.zoom,
  }
  return clampView(size, moved)
}

/** Pan by a screen space delta in pixels. */
export function panBy(size: Size, view: View, dx: number, dy: number): View {
  return clampView(size, {
    centerLon: view.centerLon - (dx / worldWidth(size, view)) * 360,
    centerLat: view.centerLat + (dy / worldHeight(size, view)) * 180,
    zoom: view.zoom,
  })
}

/** The rectangle of the plate in screen pixels, used to draw its frame. */
export function plateRect(size: Size, view: View): { x: number; y: number; width: number; height: number } {
  const w = worldWidth(size, view)
  const h = w / 2
  return {
    x: size.width / 2 - w / 2 - (view.centerLon / 360) * w,
    y: size.height / 2 - h / 2 + (view.centerLat / 180) * h,
    width: w,
    height: h,
  }
}

/**
 * How many copies of the world to draw either side of the middle one so the map
 * stays continuous across the antimeridian.
 */
export function wrapCopies(size: Size, view: View): number[] {
  const w = worldWidth(size, view)
  if (w >= size.width * 0.999) return [-360, 0, 360]
  return [0]
}
