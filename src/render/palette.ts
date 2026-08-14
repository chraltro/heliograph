/**
 * The colour of the map is the colour of that place, at that solar elevation.
 *
 * Rather than tinting a photograph, the renderer looks up what ocean, land and
 * permanent ice actually look like from directly overhead at every angle of the
 * Sun, and shades each pixel from the elevation computed for its own latitude
 * and longitude. Everything else (the glint, the city lights, the coastline) is
 * added in linear light on top and tone mapped once at the end.
 */

export type Rgb = readonly [number, number, number]

// ---------------------------------------------------------------- colour space

/** OKLab to linear sRGB, after Bjorn Ottosson. */
export function oklabToLinearRgb(lightness: number, a: number, b: number): Rgb {
  const l_ = lightness + 0.3963377774 * a + 0.2158037573 * b
  const m_ = lightness - 0.1055613458 * a - 0.0638541728 * b
  const s_ = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** Linear sRGB to OKLab. */
export function linearRgbToOklab(r: number, g: number, b: number): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLCH to linear sRGB. Lightness 0..1, hue in degrees. */
export function oklchToLinearRgb(lightness: number, chroma: number, hue: number): Rgb {
  const h = (hue * Math.PI) / 180
  return oklabToLinearRgb(lightness, chroma * Math.cos(h), chroma * Math.sin(h))
}

export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function linearToSrgb(v: number): number {
  const c = Math.max(0, Math.min(1, v))
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

export function hexToLinearRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16)
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)]
}

export function linearRgbToHex(rgb: Rgb): string {
  const encode = (v: number) =>
    Math.round(linearToSrgb(v) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${encode(rgb[0])}${encode(rgb[1])}${encode(rgb[2])}`
}

export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  return linearRgbToHex(oklchToLinearRgb(lightness, chroma, hue))
}

// ---------------------------------------------------------------- surface ramps

/**
 * What ocean, land and permanent ice look like from directly overhead at every
 * solar elevation, in degrees, from the Sun at the zenith down to well past the
 * end of astronomical twilight.
 *
 * These are not invented. They come from a spectral model built on published
 * constants (the ASTM G-173 solar spectrum, IUP Bremen ozone cross sections, the
 * Bruneton Rayleigh and Mie parameters, Kasten and Young air mass) cross checked
 * against measured imagery: Apollo 17 AS17-148-22727 for the ocean percentiles,
 * NASA Blue Marble for the land median, and Patat et al. 2006 twilight
 * photometry for the hue of the sky below the horizon. The derivation, stop by
 * stop, is in docs/research/twilight-color.md.
 *
 * Three things worth knowing before editing them. The hue below the horizon runs
 * gold, red, the Belt of Venus rose, magenta, then violet, because that is the
 * order the real sky does it. The night floor arrives near -15 degrees, not -18,
 * so nothing changes below that. And ice stays clearly lighter than land at
 * night, which is correct, because snow is bright under starlight.
 */
export const RAMP_ELEVATIONS = [90, 60, 30, 18, 12, 6, 2, 0, -2, -4, -6, -9, -12, -15, -18, -25] as const

export const SURFACE_RAMPS = {
  ocean: [
    '#123b61', '#123a5f', '#113659', '#0f3052', '#0f2c4c', '#0f2644', '#0f213c', '#0f1d38',
    '#0d1733', '#0b1030', '#0a0b2b', '#070625', '#06041c', '#050414', '#03040f', '#02040e',
  ],
  land: [
    '#7b764f', '#7a734b', '#766d42', '#736335', '#715b28', '#6e4d13', '#6a3a00', '#652f00',
    '#581e06', '#461315', '#330d22', '#180c29', '#0b0921', '#080717', '#050612', '#030711',
  ],
  ice: [
    '#f3f2eb', '#efede3', '#e7e2d2', '#e1d5bf', '#ddcab1', '#d5b599', '#cd9b82', '#c58c78',
    '#ac716a', '#8c5863', '#664663', '#3a3355', '#23233e', '#17172a', '#0f1220', '#0c121e',
  ],
} as const

export type SurfaceName = keyof typeof SURFACE_RAMPS

/** Elevation range the lookup tables cover, in degrees. */
export const RAMP_RANGE = { min: -25, max: 90 } as const

/**
 * Undo the renderer's tone map, so a value stored in the table comes back out of
 * the shader as exactly the colour the ramp specifies. Anything added on top
 * then rolls off correctly against it.
 */
function untone(linear: number, exposure: number): number {
  return -Math.log(Math.max(1e-5, 1 - Math.min(0.9995, linear))) / exposure
}

/** Sample a ramp at one elevation, interpolating in OKLab. Used by the tests. */
export function sampleSurfaceRamp(surface: SurfaceName, elevation: number): Rgb {
  const hexes = SURFACE_RAMPS[surface]
  if (elevation >= RAMP_ELEVATIONS[0]!) return hexToLinearRgb(hexes[0]!)
  const lastIndex = RAMP_ELEVATIONS.length - 1
  if (elevation <= RAMP_ELEVATIONS[lastIndex]!) return hexToLinearRgb(hexes[lastIndex]!)
  for (let s = 0; s + 1 < RAMP_ELEVATIONS.length; s++) {
    const hi = RAMP_ELEVATIONS[s]!
    const lo = RAMP_ELEVATIONS[s + 1]!
    if (elevation <= hi && elevation >= lo) {
      const t = (hi - elevation) / (hi - lo)
      const w = t * t * (3 - 2 * t)
      const a = linearRgbToOklab(...(hexToLinearRgb(hexes[s]!) as [number, number, number]))
      const b = linearRgbToOklab(...(hexToLinearRgb(hexes[s + 1]!) as [number, number, number]))
      return oklabToLinearRgb(a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w)
    }
  }
  return hexToLinearRgb(hexes[lastIndex]!)
}

/** Bake a surface ramp into a lookup table of scene referred linear light. */
export function buildSurfaceLut(surface: SurfaceName, size: number, exposure: number): Float32Array {
  const stops = SURFACE_RAMPS[surface].map((hex) => {
    const [r, g, b] = hexToLinearRgb(hex)
    return linearRgbToOklab(untone(r, exposure), untone(g, exposure), untone(b, exposure))
  })
  const data = new Float32Array(size * 4)
  const { min, max } = RAMP_RANGE
  for (let i = 0; i < size; i++) {
    const elevation = min + ((i + 0.5) / size) * (max - min)
    let lab: Rgb = stops[stops.length - 1]!
    if (elevation >= RAMP_ELEVATIONS[0]!) {
      lab = stops[0]!
    } else {
      for (let s = 0; s + 1 < RAMP_ELEVATIONS.length; s++) {
        const hi = RAMP_ELEVATIONS[s]!
        const lo = RAMP_ELEVATIONS[s + 1]!
        if (elevation <= hi && elevation >= lo) {
          const t = (hi - elevation) / (hi - lo)
          const w = t * t * (3 - 2 * t)
          const a = stops[s]!
          const b = stops[s + 1]!
          lab = [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]
          break
        }
      }
    }
    const [r, g, b] = oklabToLinearRgb(lab[0], lab[1], lab[2])
    data[i * 4] = Math.max(0, r)
    data[i * 4 + 1] = Math.max(0, g)
    data[i * 4 + 2] = Math.max(0, b)
    data[i * 4 + 3] = 1
  }
  return data
}

// ---------------------------------------------------------------- emissive

/**
 * The things allowed to sit above 1.0 in linear light, which is what gives the
 * bloom something real to work with.
 */
export const LIGHT = {
  /** Sunlight bouncing off water straight back at the viewer. */
  glint: oklchToLinearRgb(0.99, 0.028, 88),
  /** The marker halo at the subsolar point. */
  subsolar: oklchToLinearRgb(1.0, 0.036, 84),
  /** Sodium and LED mixed the way a city looks from orbit. */
  cityLight: oklchToLinearRgb(0.87, 0.104, 74),
  /** A warm rim on lit shores, a cold one on dark shores. */
  coastDay: oklchToLinearRgb(0.95, 0.052, 76),
  coastNight: oklchToLinearRgb(0.44, 0.028, 252),
} as const

// ---------------------------------------------------------------- interface

/**
 * One cool neutral ramp at OKLCH hue 250 with the chroma tapering off as the
 * lightness rises, because tint is most useful in the dark end and bright
 * surfaces desaturate anyway. Then one warm ramp, which is the Sun.
 *
 * Duplicated as custom properties in style.css; this copy is what the overlay
 * canvas draws with, so the two must stay in step.
 */
export const INK = {
  0: '#060b10',
  50: '#10151b',
  100: '#1c2127',
  200: '#2e3339',
  300: '#494e53',
  400: '#6c7176',
  500: '#8e9398',
  600: '#b4b8bc',
  700: '#d5d8db',
  800: '#eef0f3',
} as const

export const SUN = {
  300: '#d9951d',
  400: '#f7ad30',
  500: '#ffc353',
  600: '#ffdb8d',
} as const
