import type { WorldData } from '../data/world.ts'
import type { SolarState } from '../solar/solar.ts'
import { createBuffer, createProgram, createVao, Uniforms } from './gl.ts'
import { LINE_QUAD, ringSegments, stripSegments, triangulate } from './geometry.ts'
import { buildSurfaceLut, hexToLinearRgb, INK, LIGHT, RAMP_RANGE, type SurfaceName } from './palette.ts'
import * as S from './shaders.ts'
import { type Size, type View, worldWidth } from './view.ts'

/**
 * Everything about the picture that is worth tuning by eye. Collected in one
 * place so a screenshot session can move numbers without hunting through shaders.
 */
export interface Tuning {
  exposure: number
  glintGain: number
  surfaceDetail: number
  iceAmount: number
  cityIntensity: number
  citySizeMin: number
  citySizeMax: number
  coastWidth: number
  coastIntensity: number
  /** How much of the coastline survives in full daylight. */
  coastDayFade: number
  /** Brightness of a full moon at the zenith, in scene referred linear light. */
  moonlight: number
  borderWidth: number
  borderIntensity: number
  sunspotSize: number
  sunspotIntensity: number
  bloomThreshold: number
  bloomSoftKnee: number
  bloomStrength: number
  bloomRadius: number
  vignette: number
  grain: number
  aberration: number
}

export const DEFAULT_TUNING: Tuning = {
  exposure: 1.55,
  glintGain: 1.6,
  surfaceDetail: 0.34,
  iceAmount: 0.82,
  cityIntensity: 0.72,
  citySizeMin: 2.0,
  citySizeMax: 13,
  coastWidth: 0.9,
  coastIntensity: 0.5,
  coastDayFade: 0.16,
  moonlight: 0.008,
  borderWidth: 0.85,
  borderIntensity: 0.28,
  sunspotSize: 14,
  sunspotIntensity: 1.7,
  bloomThreshold: 1.05,
  bloomSoftKnee: 0.45,
  bloomStrength: 0.34,
  bloomRadius: 2.2,
  vignette: 0.3,
  grain: 0.022,
  aberration: 0.6,
}

export interface Layers {
  coast: boolean
  borders: boolean
  cities: boolean
  lakes: boolean
}

export interface Frame {
  view: View
  /** Viewport in CSS pixels. */
  size: Size
  sun: SolarState
  /**
   * Where the Moon stands overhead and how hard it is shining, with the phase
   * and the distance already folded into the gain. Null leaves the night dark.
   */
  moon: { lon: number; lat: number; gain: number } | null
  /**
   * Set to draw every zone at the same reading of its own clock instead of one
   * instant across the whole world. The offset is the zone whose clock the rest
   * are matched to; the rate is how fast the solar declination is drifting, in
   * degrees per hour, which corrects the small error over fourteen hours of
   * offset.
   */
  localTime: { referenceOffsetHours: number; declinationRatePerHour: number } | null
  /**
   * The Sun and Moon as vectors, in thousands of kilometres, so the shader can
   * work out how much of the Sun each point can still see. Null when the two
   * are nowhere near each other, which is almost always.
   */
  eclipse: { sun: readonly [number, number, number]; moon: readonly [number, number, number]; gmst: number } | null
  layers: Layers
  /** Seconds since load, for the film grain. Hold it still to freeze the grain. */
  time: number
  tuning: Tuning
}

interface Pass {
  program: WebGLProgram
  uniforms: Uniforms
  vao: WebGLVertexArrayObject | null
}

const BLOOM_DIVISOR = 4

/** The zone offset raster, in geographic pixels. */
const ZONE_RASTER_WIDTH = 2048
const ZONE_RASTER_HEIGHT = 1024

export class MapRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly world: WorldData

  private readonly ocean: Pass
  private readonly land: Pass
  private readonly lake: Pass
  private readonly coast: Pass
  private readonly border: Pass
  private readonly city: Pass
  private readonly sunspot: Pass
  private readonly bright: Pass
  private readonly blur: Pass
  private readonly present: Pass

  private readonly counts: { land: number; lake: number; coast: number; border: number; city: number }
  private readonly ramps: Record<SurfaceName, WebGLTexture>
  private readonly groundClear: [number, number, number]
  private terrain: WebGLTexture
  private season: WebGLTexture
  private terrainReady = false
  private readonly zoneOffsetPass: Pass
  private readonly zoneOffsetBuffer: WebGLBuffer
  private readonly zoneVertexFeature: Float32Array
  private readonly zoneOffsetCount: number
  private zoneOffsetTexture: WebGLTexture
  private zoneOffsetFbo: WebGLFramebuffer | null = null

  private width = 1
  private height = 1
  private samples = 0
  private floatTargets = false

  private sceneFbo: WebGLFramebuffer | null = null
  private sceneRenderbuffer: WebGLRenderbuffer | null = null
  private resolveFbo: WebGLFramebuffer | null = null
  private resolveTexture: WebGLTexture | null = null
  private bloomFbo: [WebGLFramebuffer | null, WebGLFramebuffer | null] = [null, null]
  private bloomTexture: [WebGLTexture | null, WebGLTexture | null] = [null, null]

  constructor(canvas: HTMLCanvasElement, world: WorldData) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 is required and is not available in this browser')
    this.gl = gl
    this.world = world

    // Half float render targets are what let the glint and the brightest cities
    // sit above 1.0 so the bloom has something real to work with.
    this.floatTargets =
      gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null
    this.samples = this.floatTargets ? Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number) : 0

    const quad = createBuffer(gl, LINE_QUAD)
    const cornerQuad = createBuffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]))

    // Ocean: one triangle, no attributes.
    this.ocean = this.pass(S.FULLSCREEN_VS, S.OCEAN_FS, null)

    const landMesh = triangulate(world.land)
    const landProgram = createProgram(gl, S.LAND_VS, S.LAND_FS)
    const landPositions = createBuffer(gl, landMesh.positions)
    const landIndices = createBuffer(gl, landMesh.indices, gl.ELEMENT_ARRAY_BUFFER)
    this.land = {
      program: landProgram,
      uniforms: new Uniforms(gl, landProgram),
      vao: createVao(gl, landProgram, { aPosition: { buffer: landPositions, size: 2 } }, landIndices),
    }

    const lakeMesh = triangulate(world.lakes)
    const lakeProgram = createProgram(gl, S.LAND_VS, S.LAKE_FS)
    const lakePositions = createBuffer(gl, lakeMesh.positions)
    const lakeIndices = createBuffer(gl, lakeMesh.indices, gl.ELEMENT_ARRAY_BUFFER)
    this.lake = {
      program: lakeProgram,
      uniforms: new Uniforms(gl, lakeProgram),
      vao: createVao(gl, lakeProgram, { aPosition: { buffer: lakePositions, size: 2 } }, lakeIndices),
    }

    // The zone offset raster: zone polygons drawn straight into a geographic
    // texture, so every later pass can ask what the clock says at a point.
    const zoneMesh = triangulate(world.timezones, true)
    const zoneProgram = createProgram(gl, S.ZONE_OFFSET_VS, S.ZONE_OFFSET_FS)
    const zonePositions = createBuffer(gl, zoneMesh.positions)
    const zoneIndices = createBuffer(gl, zoneMesh.indices, gl.ELEMENT_ARRAY_BUFFER)
    this.zoneVertexFeature = zoneMesh.featureIds ?? new Float32Array(zoneMesh.positions.length / 2)
    this.zoneOffsetBuffer = createBuffer(gl, new Float32Array(this.zoneVertexFeature.length))
    this.zoneOffsetCount = zoneMesh.indices.length
    this.zoneOffsetPass = {
      program: zoneProgram,
      uniforms: new Uniforms(gl, zoneProgram),
      vao: createVao(
        gl,
        zoneProgram,
        {
          aPosition: { buffer: zonePositions, size: 2 },
          aOffset: { buffer: this.zoneOffsetBuffer, size: 1 },
        },
        zoneIndices,
      ),
    }
    this.zoneOffsetTexture = this.createZoneOffsetTarget()

    const coastData = ringSegments(world.land)
    const coastProgram = createProgram(gl, S.LINE_VS, S.COASTLINE_FS)
    const coastBuffer = createBuffer(gl, coastData)
    this.coast = {
      program: coastProgram,
      uniforms: new Uniforms(gl, coastProgram),
      vao: createVao(gl, coastProgram, {
        aCorner: { buffer: quad, size: 2 },
        aSegment: { buffer: coastBuffer, size: 4, divisor: 1 },
      }),
    }

    const borderData = stripSegments(world.borders)
    const borderProgram = createProgram(gl, S.LINE_VS, S.BORDER_FS)
    const borderBuffer = createBuffer(gl, borderData)
    this.border = {
      program: borderProgram,
      uniforms: new Uniforms(gl, borderProgram),
      vao: createVao(gl, borderProgram, {
        aCorner: { buffer: quad, size: 2 },
        aSegment: { buffer: borderBuffer, size: 4, divisor: 1 },
      }),
    }

    const cityData = new Float32Array(world.cities.length * 3)
    world.cities.forEach((c, i) => {
      cityData[i * 3] = c.lon
      cityData[i * 3 + 1] = c.lat
      cityData[i * 3 + 2] = c.magnitude
    })
    const cityProgram = createProgram(gl, S.CITY_VS, S.CITY_FS)
    const cityBuffer = createBuffer(gl, cityData)
    this.city = {
      program: cityProgram,
      uniforms: new Uniforms(gl, cityProgram),
      vao: createVao(gl, cityProgram, {
        aCorner: { buffer: cornerQuad, size: 2 },
        aCity: { buffer: cityBuffer, size: 3, divisor: 1 },
      }),
    }

    const sunProgram = createProgram(gl, S.SUNSPOT_VS, S.SUNSPOT_FS)
    this.sunspot = {
      program: sunProgram,
      uniforms: new Uniforms(gl, sunProgram),
      vao: createVao(gl, sunProgram, { aCorner: { buffer: cornerQuad, size: 2 } }),
    }

    this.bright = this.pass(S.FULLSCREEN_VS, S.BRIGHT_FS, null)
    this.blur = this.pass(S.FULLSCREEN_VS, S.BLUR_FS, null)
    this.present = this.pass(S.FULLSCREEN_VS, S.PRESENT_FS, null)

    this.counts = {
      land: landMesh.indices.length,
      lake: lakeMesh.indices.length,
      coast: coastData.length / 4,
      border: borderData.length / 4,
      city: world.cities.length,
    }

    this.ramps = {
      ocean: this.createLutTexture('ocean'),
      land: this.createLutTexture('land'),
      ice: this.createLutTexture('ice'),
    }

    // Single pixels stand in until the real imagery arrives, so the land pass
    // can bind something on the very first frame. The season placeholder is a
    // gain of one, encoded against the shader's scale of four.
    this.terrain = this.createPixel([128, 128, 128, 255])
    this.season = this.createPixel([64, 64, 64, 255])

    // Clearing to the exact ground colour means the surround, the letterbox and
    // the CSS behind the canvas are all literally the same value.
    const groundLinear = hexToLinearRgb(INK[0])
    const invertTone = (v: number) => -Math.log(Math.max(1e-6, 1 - v)) / DEFAULT_TUNING.exposure
    this.groundClear = [invertTone(groundLinear[0]), invertTone(groundLinear[1]), invertTone(groundLinear[2])]
  }

  /** The geographic raster the zone offsets are drawn into, and its target. */
  private createZoneOffsetTarget(): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('could not create the zone offset texture')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // Two thousand pixels across the world is a little over ten kilometres at
    // the equator, which is finer than any zone boundary the data carries.
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, ZONE_RASTER_WIDTH, ZONE_RASTER_HEIGHT)
    // Nearest, because an offset is a label and interpolating between two of
    // them would invent a zone that does not exist along every boundary.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    this.zoneOffsetFbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.zoneOffsetFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return texture
  }

  /**
   * Redraw the offset raster. Called when the offsets change, which is when a
   * daylight saving transition is crossed, and not once a frame.
   */
  setZoneOffsets(offsetsByFeature: Float64Array): void {
    const gl = this.gl
    const perVertex = new Float32Array(this.zoneVertexFeature.length)
    for (let i = 0; i < perVertex.length; i++) {
      perVertex[i] = offsetsByFeature[this.zoneVertexFeature[i]!] ?? 0
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.zoneOffsetBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, perVertex, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.zoneOffsetFbo)
    gl.viewport(0, 0, ZONE_RASTER_WIDTH, ZONE_RASTER_HEIGHT)
    gl.disable(gl.BLEND)
    // Alpha zero means "no zone here", which the shader reads as the open sea.
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.zoneOffsetPass.program)
    gl.bindVertexArray(this.zoneOffsetPass.vao)
    gl.drawElements(gl.TRIANGLES, this.zoneOffsetCount, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
  }

  private pass(vs: string, fs: string, vao: WebGLVertexArrayObject | null): Pass {
    const program = createProgram(this.gl, vs, fs)
    return { program, uniforms: new Uniforms(this.gl, program), vao }
  }

  private createLutTexture(surface: SurfaceName): WebGLTexture {
    const gl = this.gl
    const size = 1024
    const data = buildSurfaceLut(surface, size, DEFAULT_TUNING.exposure)
    const texture = gl.createTexture()
    if (!texture) throw new Error(`could not create the ${surface} lookup texture`)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    if (this.floatTargets) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, size, 1, 0, gl.RGBA, gl.FLOAT, data)
    } else {
      const bytes = new Uint8Array(size * 4)
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(Math.min(1, data[i] ?? 0) * 255)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
  }

  private createPixel(rgba: [number, number, number, number]): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('could not create a placeholder texture')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba))
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
  }

  /**
   * Install the imagery once it has decoded.
   *
   * The albedo is stored as sRGB so the sampler hands the shader linear light.
   * The seasonal field is a gain rather than a colour, so it is stored plainly
   * and must not go through the transfer function. Both wrap horizontally
   * because longitude does, and both are mipmapped because the map zooms
   * across a factor of twelve.
   */
  setTerrain(albedo: TexImageSource, season: TexImageSource): void {
    const gl = this.gl
    const upload = (source: TexImageSource, srgb: boolean): WebGLTexture => {
      const texture = gl.createTexture()
      if (!texture) throw new Error('could not create the terrain texture')
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindTexture(gl.TEXTURE_2D, null)
      return texture
    }
    const nextTerrain = upload(albedo, true)
    const nextSeason = upload(season, false)
    gl.deleteTexture(this.terrain)
    gl.deleteTexture(this.season)
    this.terrain = nextTerrain
    this.season = nextSeason
    this.terrainReady = true
  }

  /** Size in device pixels. Rebuilds every render target. */
  resize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    if (w === this.width && h === this.height && this.sceneFbo) return
    this.width = w
    this.height = h

    const gl = this.gl
    gl.canvas.width = w
    gl.canvas.height = h
    this.releaseTargets()

    const colourFormat = this.floatTargets ? gl.RGBA16F : gl.RGBA8

    if (this.samples > 1) {
      this.sceneRenderbuffer = gl.createRenderbuffer()
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.sceneRenderbuffer)
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, colourFormat, w, h)
      this.sceneFbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.sceneRenderbuffer)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        // Multisampling is a nicety; carry on without it rather than failing.
        this.samples = 0
        this.releaseTargets()
      }
    }

    this.resolveTexture = this.createTarget(w, h, colourFormat)
    this.resolveFbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resolveFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.resolveTexture, 0)

    if (this.samples <= 1) {
      this.sceneFbo = this.resolveFbo
    }

    const bw = Math.max(1, Math.floor(w / BLOOM_DIVISOR))
    const bh = Math.max(1, Math.floor(h / BLOOM_DIVISOR))
    for (const i of [0, 1] as const) {
      const texture = this.createTarget(bw, bh, colourFormat)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      this.bloomTexture[i] = texture
      this.bloomFbo[i] = fbo
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private createTarget(w: number, h: number, format: number): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('could not create a render target')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
  }

  private releaseTargets(): void {
    const gl = this.gl
    if (this.sceneFbo && this.sceneFbo !== this.resolveFbo) gl.deleteFramebuffer(this.sceneFbo)
    if (this.sceneRenderbuffer) gl.deleteRenderbuffer(this.sceneRenderbuffer)
    if (this.resolveFbo) gl.deleteFramebuffer(this.resolveFbo)
    if (this.resolveTexture) gl.deleteTexture(this.resolveTexture)
    for (const i of [0, 1] as const) {
      if (this.bloomFbo[i]) gl.deleteFramebuffer(this.bloomFbo[i])
      if (this.bloomTexture[i]) gl.deleteTexture(this.bloomTexture[i])
      this.bloomFbo[i] = null
      this.bloomTexture[i] = null
    }
    this.sceneFbo = null
    this.sceneRenderbuffer = null
    this.resolveFbo = null
    this.resolveTexture = null
  }

  /**
   * Which copies of the world overlap the viewport. Drawing three unconditionally
   * would triple the geometry for nothing at world zoom.
   */
  private visibleCopies(frame: Frame): number[] {
    const worldW = worldWidth(frame.size, frame.view)
    // While the whole world fits across the viewport there is nothing to wrap
    // to: the map is a plate floating in the surround, not an endless strip.
    if (worldW <= frame.size.width) return [0]

    // Deliberately not unproject(), which wraps its answer into the usual range
    // and would report the left edge of the screen as being east of the right.
    const half = ((frame.size.width / 2) / worldW) * 360
    const lonMin = frame.view.centerLon - half
    const lonMax = frame.view.centerLon + half

    const margin = 0.5
    const offsets: number[] = []
    for (let k = -2; k <= 2; k++) {
      const copyMin = -180 + k * 360
      const copyMax = 180 + k * 360
      if (copyMax > lonMin + margin && copyMin < lonMax - margin) offsets.push(k * 360)
    }
    return offsets.length > 0 ? offsets : [0]
  }

  /** Common uniforms every geographic stage needs. */
  private setView(u: Uniforms, frame: Frame, dpr: number, lonOffset: number): void {
    const gl = this.gl
    u.f2('uResolution', this.width, this.height)
    u.f3('uView', frame.view.centerLon, frame.view.centerLat, worldWidth(frame.size, frame.view) * dpr)
    u.f1('uLonOffset', lonOffset)
    u.f2('uSun', frame.sun.declination, frame.sun.subsolarLon)
    gl.activeTexture(gl.TEXTURE4)
    gl.bindTexture(gl.TEXTURE_2D, this.zoneOffsetTexture)
    gl.activeTexture(gl.TEXTURE0)
    u.i1('uOffsets', 4)
    u.f1('uLocalTime', frame.localTime ? 1 : 0)
    u.f1('uRefOffset', frame.localTime?.referenceOffsetHours ?? 0)
    u.f1('uDecRate', frame.localTime?.declinationRatePerHour ?? 0)
    const eclipse = frame.eclipse
    u.f3('uSunVec', eclipse?.sun[0] ?? 0, eclipse?.sun[1] ?? 0, eclipse?.sun[2] ?? 1)
    u.f3('uMoonVec', eclipse?.moon[0] ?? 0, eclipse?.moon[1] ?? 0, eclipse?.moon[2] ?? 1)
    u.f1('uGmst', eclipse?.gmst ?? 0)
    u.f1('uEclipse', eclipse ? 1 : 0)
    u.f2('uMoon', frame.moon?.lon ?? 0, frame.moon?.lat ?? 0)
    u.f3('uMoonTint', ...LIGHT.moonlight)
    u.f1('uMoonGain', (frame.moon?.gain ?? 0) * this.moonlightGain)
  }

  /** Scales every moonlit surface at once, so the effect can be tuned by eye. */
  private moonlightGain = DEFAULT_TUNING.moonlight

  /** Bind the surface ramps a pass shades from. */
  private setRamps(u: Uniforms, t: Tuning, a: SurfaceName, b?: SurfaceName): void {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.ramps[a])
    u.i1('uRampA', 0)
    if (b) {
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.ramps[b])
      u.i1('uRampB', 1)
      gl.activeTexture(gl.TEXTURE0)
    }
    u.f2('uRampRange', RAMP_RANGE.min, RAMP_RANGE.max)
    u.f1('uSurfaceDetail', t.surfaceDetail)
  }

  render(frame: Frame): void {
    const gl = this.gl
    this.moonlightGain = frame.tuning.moonlight
    const dpr = this.width / frame.size.width
    const t = frame.tuning
    const copies = this.visibleCopies(frame)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo)
    gl.viewport(0, 0, this.width, this.height)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.clearColor(this.groundClear[0], this.groundClear[1], this.groundClear[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Ocean. One fullscreen pass; longitude wrapping is free because the shader
    // works from the cosine of the hour angle.
    gl.useProgram(this.ocean.program)
    this.setView(this.ocean.uniforms, frame, dpr, 0)
    this.setRamps(this.ocean.uniforms, t, 'ocean')
    this.ocean.uniforms.f3('uGlint', ...LIGHT.glint)
    this.ocean.uniforms.f1('uGlintGain', t.glintGain)
    this.ocean.uniforms.f2('uLonRange', -180 + Math.min(...copies), 180 + Math.max(...copies))
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Land.
    gl.useProgram(this.land.program)
    gl.bindVertexArray(this.land.vao)
    this.setRamps(this.land.uniforms, t, 'land', 'ice')
    this.land.uniforms.f1('uIceAmount', t.iceAmount)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.terrain)
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, this.season)
    gl.activeTexture(gl.TEXTURE0)
    this.land.uniforms.i1('uTerrain', 2)
    this.land.uniforms.i1('uSeason', 3)
    this.land.uniforms.f1('uTerrainAmount', this.terrainReady ? 1 : 0)
    for (const offset of copies) {
      this.setView(this.land.uniforms, frame, dpr, offset)
      gl.drawElements(gl.TRIANGLES, this.counts.land, gl.UNSIGNED_INT, 0)
    }

    if (frame.layers.lakes) {
      gl.useProgram(this.lake.program)
      gl.bindVertexArray(this.lake.vao)
      this.setRamps(this.lake.uniforms, t, 'ocean')
      for (const offset of copies) {
        this.setView(this.lake.uniforms, frame, dpr, offset)
        gl.drawElements(gl.TRIANGLES, this.counts.lake, gl.UNSIGNED_INT, 0)
      }
    }

    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    if (frame.layers.borders) {
      gl.useProgram(this.border.program)
      gl.bindVertexArray(this.border.vao)
      const u = this.border.uniforms
      u.f1('uWidth', t.borderWidth * dpr)
      u.f1('uFeather', 0.75 * dpr)
      const tint = hexToLinearRgb(INK[300])
      u.f3('uTint', tint[0], tint[1], tint[2])
      u.f1('uIntensity', t.borderIntensity)
      for (const offset of copies) {
        this.setView(u, frame, dpr, offset)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.counts.border)
      }
    }

    if (frame.layers.coast) {
      gl.useProgram(this.coast.program)
      gl.bindVertexArray(this.coast.vao)
      const u = this.coast.uniforms
      u.f1('uWidth', t.coastWidth * dpr)
      u.f1('uFeather', 0.7 * dpr)
      u.f3('uDayTint', ...LIGHT.coastDay)
      u.f3('uNightTint', ...LIGHT.coastNight)
      u.f1('uIntensity', t.coastIntensity)
      u.f1('uDayFade', t.coastDayFade)
      for (const offset of copies) {
        this.setView(u, frame, dpr, offset)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.counts.coast)
      }
    }

    gl.blendFunc(gl.ONE, gl.ONE)

    if (frame.layers.cities) {
      gl.useProgram(this.city.program)
      gl.bindVertexArray(this.city.vao)
      const u = this.city.uniforms
      u.f3('uLightColour', ...LIGHT.cityLight)
      u.f1('uIntensity', t.cityIntensity)
      u.f1('uSizeMin', t.citySizeMin * dpr)
      u.f1('uSizeMax', t.citySizeMax * dpr)
      u.f1('uZoom', frame.view.zoom)
      for (const offset of copies) {
        this.setView(u, frame, dpr, offset)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.counts.city)
      }
    }

    // The subsolar halo lives in the scene so that it blooms.
    gl.useProgram(this.sunspot.program)
    gl.bindVertexArray(this.sunspot.vao)
    {
      const u = this.sunspot.uniforms
      u.f3('uColour', ...LIGHT.subsolar)
      u.f1('uIntensity', t.sunspotIntensity)
      u.f1('uSize', t.sunspotSize * dpr)
      for (const offset of copies) {
        this.setView(u, frame, dpr, offset)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
    }

    gl.bindVertexArray(null)
    gl.disable(gl.BLEND)

    // Resolve multisampling into a sampleable texture.
    if (this.samples > 1 && this.sceneFbo !== this.resolveFbo) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sceneFbo)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resolveFbo)
      gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    }

    this.renderBloom(t)

    // Present.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(this.present.program)
    const p = this.present.uniforms
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.resolveTexture)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTexture[0])
    p.i1('uScene', 0)
    p.i1('uBloom', 1)
    p.f2('uResolution', this.width, this.height)
    p.f1('uExposure', t.exposure)
    p.f1('uBloomStrength', t.bloomStrength)
    p.f1('uVignette', t.vignette)
    p.f1('uGrain', t.grain)
    p.f1('uAberration', t.aberration * dpr)
    p.f1('uTime', frame.time)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.activeTexture(gl.TEXTURE0)
  }

  private renderBloom(t: Tuning): void {
    const gl = this.gl
    const bw = Math.max(1, Math.floor(this.width / BLOOM_DIVISOR))
    const bh = Math.max(1, Math.floor(this.height / BLOOM_DIVISOR))
    gl.viewport(0, 0, bw, bh)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFbo[1])
    gl.useProgram(this.bright.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.resolveTexture)
    this.bright.uniforms.i1('uScene', 0)
    this.bright.uniforms.f1('uThreshold', t.bloomThreshold)
    this.bright.uniforms.f1('uSoftKnee', t.bloomSoftKnee)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.useProgram(this.blur.program)
    this.blur.uniforms.i1('uSource', 0)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFbo[0])
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTexture[1])
    this.blur.uniforms.f2('uDirection', t.bloomRadius / bw, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFbo[1])
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTexture[0])
    this.blur.uniforms.f2('uDirection', 0, t.bloomRadius / bh)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Leave the finished glow in slot 0 so present() always reads the same one.
    const [a, b] = this.bloomTexture
    this.bloomTexture = [b, a]
    const [fa, fb] = this.bloomFbo
    this.bloomFbo = [fb, fa]

    gl.viewport(0, 0, this.width, this.height)
  }

  /** Cities near a point, for the hover readout. */
  get cityCount(): number {
    return this.world.cities.length
  }

  dispose(): void {
    this.releaseTargets()
    for (const texture of Object.values(this.ramps)) this.gl.deleteTexture(texture)
    this.gl.deleteTexture(this.terrain)
    this.gl.deleteTexture(this.season)
    this.gl.deleteTexture(this.zoneOffsetTexture)
    if (this.zoneOffsetFbo) this.gl.deleteFramebuffer(this.zoneOffsetFbo)
  }
}
