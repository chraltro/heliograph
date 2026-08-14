/**
 * A slider whose track is made of the data.
 *
 * The day scrubber's track is the actual sky colour at the chosen place across
 * twenty four hours, so sunrise, the golden hour, the three twilights and night
 * are all visible as bands inside the control itself. The year scrubber's track
 * is the same reading across three hundred and sixty five days. Scrub one and
 * the other redraws, and the bands breathe with the seasons.
 */

export interface Tick {
  /** Where on the track, in the same units as the value. */
  at: number
  label?: string
  /** 0 for a whisper, 1 for a full height rule. */
  weight: number
}

export interface ScrubberOptions {
  label: string
  min: number
  max: number
  /** Arrow key step. */
  step: number
  /** Page up and page down step. */
  pageStep: number
  height: number
  /** Spoken value, for assistive technology. */
  describe: (value: number) => string
  onChange: (value: number, committed: boolean) => void
  /** Fills the track. Called with a context already scaled to CSS pixels. */
  paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  ticks?: () => Tick[]
}

const HANDLE = '#f7ad30'
const TICK = '#8e9398'

export class Scrubber {
  readonly element: HTMLDivElement
  private readonly track: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly handle: HTMLDivElement
  private value: number
  private dpr = 1
  private width = 0
  private dragging = false

  constructor(private readonly options: ScrubberOptions) {
    this.value = options.min

    this.element = document.createElement('div')
    this.element.className = 'scrubber'

    this.track = document.createElement('canvas')
    this.track.className = 'scrubber-track'
    this.track.style.height = `${options.height}px`
    const ctx = this.track.getContext('2d')
    if (!ctx) throw new Error('could not get a 2D context for the scrubber track')
    this.ctx = ctx

    this.handle = document.createElement('div')
    this.handle.className = 'scrubber-handle'

    const surface = document.createElement('div')
    surface.className = 'scrubber-surface'
    surface.tabIndex = 0
    surface.setAttribute('role', 'slider')
    surface.setAttribute('aria-label', options.label)
    surface.setAttribute('aria-valuemin', String(options.min))
    surface.setAttribute('aria-valuemax', String(options.max))
    surface.append(this.track, this.handle)

    this.element.append(surface)
    this.surface = surface

    surface.addEventListener('pointerdown', this.onPointerDown)
    surface.addEventListener('pointermove', this.onPointerMove)
    surface.addEventListener('pointerup', this.onPointerUp)
    surface.addEventListener('pointercancel', this.onPointerUp)
    surface.addEventListener('keydown', this.onKeyDown)
  }

  private readonly surface: HTMLDivElement

  /** Value from a pointer position, clamped to the track. */
  private valueAt(clientX: number): number {
    const rect = this.surface.getBoundingClientRect()
    const t = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    const { min, max } = this.options
    return min + Math.min(1, Math.max(0, t)) * (max - min)
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    this.dragging = true
    this.surface.setPointerCapture(event.pointerId)
    this.surface.focus({ preventScroll: true })
    this.set(this.valueAt(event.clientX), false)
    event.preventDefault()
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.dragging) return
    this.set(this.valueAt(event.clientX), false)
  }

  private readonly onPointerUp = (event: PointerEvent) => {
    if (!this.dragging) return
    this.dragging = false
    if (this.surface.hasPointerCapture(event.pointerId)) this.surface.releasePointerCapture(event.pointerId)
    this.set(this.value, true)
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const { step, pageStep, min, max } = this.options
    let next: number | null = null
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = this.value - (event.shiftKey ? pageStep : step)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = this.value + (event.shiftKey ? pageStep : step)
        break
      case 'PageDown':
        next = this.value - pageStep
        break
      case 'PageUp':
        next = this.value + pageStep
        break
      case 'Home':
        next = min
        break
      case 'End':
        next = max
        break
      default:
        return
    }
    event.preventDefault()
    this.set(Math.min(max, Math.max(min, next)), true)
  }

  private set(value: number, committed: boolean): void {
    this.value = value
    this.layout()
    this.options.onChange(value, committed)
  }

  /** Move the handle without telling anybody, for external updates. */
  setValue(value: number): void {
    this.value = value
    this.layout()
  }

  private layout(): void {
    const { min, max } = this.options
    const t = max > min ? (this.value - min) / (max - min) : 0
    this.handle.style.left = `${(t * 100).toFixed(4)}%`
    this.surface.setAttribute('aria-valuenow', String(Math.round(this.value)))
    this.surface.setAttribute('aria-valuetext', this.options.describe(this.value))
  }

  resize(dpr: number): void {
    const rect = this.surface.getBoundingClientRect()
    if (rect.width < 1) return
    this.dpr = dpr
    this.width = rect.width
    this.track.width = Math.round(rect.width * dpr)
    this.track.height = Math.round(this.options.height * dpr)
    this.track.style.width = '100%'
    this.repaint()
  }

  /** Redraw the track. Cheap enough to call whenever the reading changes. */
  repaint(): void {
    if (this.width < 1) return
    const { ctx } = this
    const height = this.options.height
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, height)
    this.options.paint(ctx, this.width, height)

    const ticks = this.options.ticks?.() ?? []
    const { min, max } = this.options
    ctx.save()
    for (const tick of ticks) {
      const t = (tick.at - min) / (max - min)
      if (t < 0 || t > 1) continue
      const x = Math.round(t * this.width) + 0.5 / this.dpr
      ctx.strokeStyle = TICK
      ctx.globalAlpha = 0.2 + 0.55 * tick.weight
      ctx.lineWidth = 1 / this.dpr
      ctx.beginPath()
      ctx.moveTo(x, height * (1 - tick.weight))
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    ctx.restore()
    this.layout()
  }
}

export { HANDLE as SCRUBBER_HANDLE_COLOUR }
