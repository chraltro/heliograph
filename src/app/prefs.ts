/**
 * What the instrument remembers between visits.
 *
 * Two rules govern all of this. A link always wins: a URL that names a layer
 * set or a time is describing a particular view, and a stored preference must
 * never quietly rewrite what somebody was sent. And storage may not exist at
 * all, because private browsing modes throw on the first write rather than the
 * first read, so every access is guarded and failure is simply forgetting.
 */

const KEY = 'heliograph.v1'

export interface SavedPlace {
  name: string
  country: string
  lon: number
  lat: number
}

export interface Preferences {
  /** Layer keys that are switched on. Null means "never been set". */
  layers: string[] | null
  /** The clock the instrument opens on. */
  basis: string | null
  /** Animation speed multiplier. */
  rate: number | null
  /** Places the viewer has starred, most recent first. */
  saved: SavedPlace[]
  /** Whether the almanac panel is open. */
  almanac: boolean
}

const EMPTY: Preferences = { layers: null, basis: null, rate: null, saved: [], almanac: false }

function storage(): Storage | null {
  try {
    const probe = window.localStorage
    // Safari in private mode has the object and throws only on write.
    probe.setItem(`${KEY}.probe`, '1')
    probe.removeItem(`${KEY}.probe`)
    return probe
  } catch {
    return null
  }
}

export function loadPreferences(): Preferences {
  const store = storage()
  if (!store) return { ...EMPTY }
  try {
    const raw = store.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return {
      layers: Array.isArray(parsed.layers) ? parsed.layers.filter((k) => typeof k === 'string') : null,
      basis: typeof parsed.basis === 'string' ? parsed.basis : null,
      rate: typeof parsed.rate === 'number' ? parsed.rate : null,
      saved: Array.isArray(parsed.saved)
        ? parsed.saved
            .filter(
              (p): p is SavedPlace =>
                p !== null &&
                typeof p === 'object' &&
                Number.isFinite((p as SavedPlace).lon) &&
                Number.isFinite((p as SavedPlace).lat),
            )
            .slice(0, 24)
        : [],
      almanac: parsed.almanac === true,
    }
  } catch {
    // Corrupt or foreign data is not worth a crash; start fresh.
    return { ...EMPTY }
  }
}

export function savePreferences(prefs: Preferences): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Quota, or a mode that refuses writes. Forgetting is an acceptable outcome.
  }
}

/** Two places are the same star if they are within a hundred metres or so. */
export function samePlace(a: SavedPlace, b: { lon: number; lat: number }): boolean {
  return Math.abs(a.lon - b.lon) < 0.002 && Math.abs(a.lat - b.lat) < 0.002
}
