# Heliograph Build Specification

Single normative document for implementation. It supersedes the six scout research notes for every
decision it makes. Where a scout note disagrees with this spec, this spec wins; where this spec is
silent, the scout note named in the cross reference is authoritative for detail.

Source notes, all under `C:/gits/personal/solar/docs/research/`:

| Short name | File | Role after this spec |
|---|---|---|
| SOLAR | `solar-math.md` | Formula transcription source, test vector source |
| TWILIGHT | `twilight-color.md` | Ramp stop source, atmospheric constants |
| WEBGL | `webgl-craft.md` | GL mechanics, SDF algorithm, measured device limits |
| TZ | `timezone-data.md` | Timezone dataset, mapshaper parameters, Intl recipes |
| BEAUTY | `beauty-references.md` | Reference survey, anti pattern catalogue |
| SHELL | `type-and-shell.md` | Type pipeline, palette, motion tokens, layout |

Writing rule for this file and every file in the repo: no em dashes, no en dashes, no
`&mdash;`, no `&ndash;`. Plain hyphens only.

Governing principle, borrowed verbatim from the NASA Eyes team via BEAUTY 1.7 and adopted as the
project's first rule: **make it as cinematic as possible without losing any of the technical or
scientific accuracy.** Grain, bloom and a vignette are permitted because a camera produces them.
Moving one degree of solar declination for aesthetic reasons is not permitted.

---

## Table of contents

1. [Conflicts resolved](#1-conflicts-resolved)
2. [Solar algorithm](#2-solar-algorithm)
3. [Test vectors](#3-test-vectors)
4. [Twilight colour ramps](#4-twilight-colour-ramps)
5. [Land, coastline and build time data assets](#5-land-coastline-and-build-time-data-assets)
6. [Timezone data](#6-timezone-data)
7. [Type and font pipeline](#7-type-and-font-pipeline)
8. [Visual system: palette, chrome, effects](#8-visual-system-palette-chrome-effects)
9. [Render architecture](#9-render-architecture)
10. [Animation model](#10-animation-model)
11. [Layout shell and responsive behaviour](#11-layout-shell-and-responsive-behaviour)
12. [Test strategy](#12-test-strategy)
13. [Project layout](#13-project-layout)
14. [Ordered build plan](#14-ordered-build-plan)
15. [Risks and open items](#15-risks-and-open-items)

---

## 1. Conflicts resolved

Every disagreement between the six notes, with the call and the reason. These are binding.

| # | Conflict | Call | Reason |
|---|---|---|---|
| C1 | TWILIGHT offers three absolute 16 stop ramps (2.4) **and** a two term `albedo * directLight + atmosphere` decomposition (2.5), and recommends the latter. BEAUTY separately proposes porting Stellarium's Preetham plus Jensen model. | **Ship the three absolute 16 stop ramps**, baked into one 256 x 3 RGBA16F LUT. | The two term model needs a Blue Marble albedo texture, which is an unbudgeted multi megabyte offline asset with its own licence and colour management problems. The absolute ramps are pinned to Apollo 17 and Himawari measurements, cost one texture fetch, and TWILIGHT itself says the ramps are the cross check the two term model must land on. Preetham is defined only for a sun above the horizon and Stellarium had to bolt a twilight extension onto it. |
| C2 | BEAUTY 5.1 says water must be lighter than land (CARTO Dark Matter). TWILIGHT's measured ramps make land lighter than ocean by day (L 0.560 vs 0.345) and ocean very slightly darker than land at night (0.112 vs 0.127). | **The measured ramps win.** Land is lighter by day, land stays 0.015 L above ocean at night. | CARTO's inversion is advice for a basemap with no solar model. Here the solar model is the product. The night floors still differ by 0.015 L, which satisfies BEAUTY's actual requirement (the shape of the world must be readable at local midnight) without inventing an unphysical ocean. |
| C3 | SOLAR 14.7 says never apply refraction in the shader and draw the gradient from geometric elevation. TWILIGHT 1.1 says the visible terminator belongs at geometric -0.8333. | **Both.** The shader uses geometric elevation with no refraction term anywhere. The terminator hairline and the sunrise/sunset threshold sit at geometric -0.8333. Ramp stops keep their published elevations. | Refraction costs a `tan` and a branch per pixel and moves the gradient by 0.6 degrees against a 6 degree wide band. It is invisible. The single place refraction matters is the named event threshold, and there it is a constant. |
| C4 | BEAUTY 1.5 and T18 want the four twilight boundaries drawn as `d3.geoCircle` hairlines at radii 90, 96, 102, 108 from the antipode. WEBGL 6.4 wants them as WebGL instanced quads regenerated every frame by marching squares. | **Neither. Draw them analytically in the sky fragment shader** from the same elevation field, as `1 - smoothstep(0, fwidth(elev) * 0.75, abs(elev - edge))`. | The boundaries are exact level sets of a scalar the shader already computes. Drawing them from the same value guarantees perfect registration with the gradient, which BEAUTY says is the whole point of having them. It also removes a d3 dependency and a per frame marching squares pass. |
| C5 | BEAUTY T5 wants per frame animated film grain at amplitude 0.022. SHELL 4.6 says never animate grain (vestibular trigger, full screen repaint) and measures 0.012 as correct. TWILIGHT 4.5 and WEBGL 8.5 want interleaved gradient noise dither at 1/255. | **Two separate, both mandatory, neither animated.** (a) Static shader grain, signed zero mean, amplitude 0.012 peak to peak in linear light, seeded once at startup. (b) Interleaved gradient noise dither at exactly 1/255, applied after the sRGB encode. | They solve different problems. Dither hides 8 bit quantisation of the ramp. Grain gives the frame a photographic surface. Animating either one is a vestibular hazard and makes visual regression diffs meaningless. |
| C6 | BEAUTY T8 recommends radial chromatic aberration at about 0.6 device pixels at the corner. | **Cut it entirely.** | It is the one effect on BEAUTY's own list with no cited numeric basis, it contradicts the precision instrument thesis in SHELL 5.2, and it adds sub pixel noise to every visual regression baseline. |
| C7 | SHELL palette (`--void #04070C`, `--text-1 #E4ECF5`, `--amber #F5B851`) versus BEAUTY palette (`--ink-000 #060b10`, `--ink-800 #eef0f3`, `--sun-400 #f7ad30`). | **SHELL's palette is normative.** | SHELL's ramp comes with measured WCAG ratios for every token and, critically, the 0.62 scrim alpha in SHELL 4.2 is computed for `#E4ECF5` over `#04070C`. Swapping the text or ground colour invalidates that number. BEAUTY's independently derived accent `#f7ad30` and nullschool's `#e2b42e` both land within one ramp step of `#F5B851`, which is confirmation, not conflict. |
| C8 | BEAUTY T16 motion tokens (120 / 260 / 420 ms, `cubic-bezier(0.16, 1, 0.30, 1)`) versus SHELL 5.2 (IBM Carbon productive set, 70 / 110 / 150 / 240 / 400 / 700 ms, `cubic-bezier(0.2, 0, 0.38, 0.9)`). | **Carbon productive set from SHELL.** | Carbon's values are read from a published token source and its productive versus expressive framing maps exactly onto instrument versus marketing. `cubic-bezier(0.16, 1, 0.30, 1)` reaches 80 percent of its travel in the first 30 percent of its duration and then drifts, which reads as a landing page at 420 ms. |
| C9 | BEAUTY 4.1 specifies a 1,240 ms load sequence. SHELL 5.4 specifies under 900 ms. | **SHELL's 900 ms budget, with BEAUTY's dependency ordering** (ground, water, land, light, instrumentation, chrome) applied inside it. | Nielsen's one second flow of thought limit is cited in both notes. BEAUTY's ordering argument is good and costs nothing; its duration is not. |
| C10 | WEBGL 6.4 assumes the timezone border layer is 155,007 vertices (Natural Earth). TZ proves Natural Earth is unusable and produces an 18,969 point replacement. | **TZ's dataset.** The performance argument in WEBGL 6.4 is moot at 19k points. | The vertex count drops by 8x and the data becomes correct at the same time. |
| C11 | WEBGL 6.4 recommends a 2D overlay canvas for all text. | **No 2D overlay canvas. All text is DOM**, positioned with `translate3d` inside the same rAF callback as the GL draw. | The register argument WEBGL makes for the 2D canvas applies identically to DOM updated in the same callback. DOM buys the whole SHELL type system for free: tabular figures, the digit slot roll, real focus rings, and screen reader access. |
| C12 | TWILIGHT 5.1 proposes a directional terminator bleed post pass; BEAUTY T7 proposes a full HDR bloom pyramid. | **Bloom pyramid only.** No directional bleed. | TWILIGHT's own section 5.1 concedes the bleed "is not bloom, it is the ramp", and the ramp already encodes it (ocean is still L 0.19 at -4 degrees). The bleed's reach, gain and band centre are all unverified. |
| C13 | WEBGL 1.4 says keep the earcut land geometry around at runtime for an exact MSAA silhouette. | **Geometry is a build time artifact only. It is not shipped.** | It is 8.1 MB indexed and the runtime is a single full screen SDF pass. The SDF's `fwidth` edge is analytically correct at 8x, which is the only thing the geometry was going to buy. |
| C14 | BEAUTY 1.6 proposes cross fading the twelve Blue Marble Next Generation monthly composites during a year scrub. | **Cut for v1.** Seasonal ice is a static mask. | BMNG at any usable resolution blows the offline budget on its own, and the year scrub already has a payoff (the declination sweep and the polar day envelope). Revisit only if a byte budget increase is agreed. |
| C15 | SOLAR offers a fast two pass fixed point rise/set solver below 60 degrees latitude and a grid scan above. | **Grid scan only, at every latitude.** | 145 cheap evaluations per day is nothing, and two code paths means the one that is exercised least is the one that breaks. The grid scan is the path SOLAR validated against USNO on all 14 hard cases. |
| C16 | SHELL recommends pairing A (Bodoni Moda, Archivo, Martian Mono) but notes that pairing A cannot render prime and double prime, so sexagesimal coordinates would tofu. | **Pairing A, and the app never displays sexagesimal coordinates.** All angles are decimal degrees. | Decimal degrees are what the model computes, they are what USNO's API returns, and they avoid a fourth font or an SVG prime glyph. `23.438 N` is also easier to compare against a fixture than `23 26 17 N`. |

---

## 2. Solar algorithm

### 2.1 The one chain to implement

Implement the **NOAA / ESRL chain, which is Meeus chapter 25 low accuracy plus Meeus chapter 28 for
the equation of time**, exactly as written out in SOLAR section 3.1. Transcribe the twelve steps and
their coefficients literally from that section. Do not retype coefficients from another source and
do not substitute SunCalc's rounded constants.

Measured accuracy, from SOLAR section 10: right ascension good to 38.9 arcsec and declination to
12.8 arcsec over 1800 to 2200; subsolar point within 10.9 arcsec of latitude and 45.8 arcsec of
longitude against USNO. One pixel of a 4096 wide equirectangular map is 316 arcsec of longitude, so
the subsolar point is correct to one seventh of a pixel.

### 2.2 Fixed conventions

These are compile time facts about the codebase, not preferences.

- **Longitude is east positive** everywhere, range `(-180, 180]`. Negate only at the Meeus chapter 13
  boundary, which uses west positive. SOLAR 14.6.
- **Azimuth is north based, clockwise**, range `[0, 360)`. Compute it as
  `mod360(degrees(atan2(sin H, cos H * sin(lat) - tan(dec) * cos(lat))) + 180)`. Do not port NOAA's
  `acos` form, its `abs(azDenom) > 0.001` guard or its `sign(hourAngle)` branch. SOLAR 3.2.
- **Every instant is an integer number of epoch milliseconds** in a plain `number`. Construct only
  via `Date.UTC(...)` or an ISO string ending in `Z`. Ban `getFullYear`, `getMonth`, `getDate`,
  `getHours`, `getMinutes`, `getSeconds`, `getTimezoneOffset` with an ESLint `no-restricted-syntax`
  rule. Use the `getUTC*` variants. SOLAR 14.1.
- **`julianDayFromMillis(ms) = ms / 86400000 + 2440587.5`**, `julianCentury(jd) = (jd - 2451545) / 36525`.
  Recompute JD from the millisecond timestamp every frame. Never accumulate it.
- **Feed UTC directly, with no delta T correction.** Measured cost: 1.14 arcsec of subsolar latitude
  and 0.36 arcsec of longitude. SOLAR 2.1.
- **Angle wrapping**: `mod360(x) = ((x % 360) + 360) % 360` for unsigned,
  `wrap180(x) = ((x + 180) % 360 + 360) % 360 - 180` for signed. JavaScript's `%` keeps the sign of
  the dividend, so a naive `x % 360` on a negative input is wrong.
- **Do not model leap seconds.** None since 2016-12-31, none scheduled. Worst case 0.9 s of UT1
  error, which is 13 arcsec of subsolar longitude, the same order as total model error. Do not print
  the subsolar point to better than three decimal places of a degree.

### 2.3 Signatures

```ts
// src/astro/solar.ts
export interface SolarState {
  jd: number;            // Julian Day
  t: number;             // Julian centuries from J2000.0
  L0: number;            // geometric mean longitude, deg, [0,360)
  M: number;             // geometric mean anomaly, deg, not normalised
  e: number;             // orbital eccentricity
  C: number;             // equation of the centre, deg
  trueLongitude: number; // deg
  R: number;             // radius vector, AU
  omega: number;         // lunar node, deg
  lambda: number;        // apparent longitude, deg
  eps0: number;          // mean obliquity, deg
  eps: number;           // corrected obliquity, deg
  alpha: number;         // apparent right ascension, deg, [0,360)
  delta: number;         // apparent declination, deg
  eot: number;           // equation of time, MINUTES of time
}
export function solarState(epochMs: number): SolarState;

export interface Subsolar { lat: number; lon: number; }   // deg, lon east positive
export function subsolarPoint(epochMs: number): Subsolar;

export interface GeoPoint { lat: number; lon: number; }   // named fields, never a bare pair
export function solarElevation(p: GeoPoint, s: Subsolar): number;   // GEOMETRIC deg
export function solarAzimuth(p: GeoPoint, s: SolarState, epochMs: number): number; // north based
export function greenwichMeanSiderealTime(jd: number): number;      // deg, Meeus 12.4
```

`subsolarPoint` uses SOLAR route A (the equation of time route), which is the cheap one:

```
utcMinutes  = ((jd + 0.5) mod 1) * 1440
lat         = delta
lon         = wrap180( -( (utcMinutes + eot) / 4 - 180 ) )
```

`solarElevation` is the only formula the map needs:

```
sin(elev) = sin(lat) sin(sLat) + cos(lat) cos(sLat) cos(lon - sLon)
```

Compute the subsolar point **once per frame on the CPU**, upload `uSubsolarLat` and `uSubsolarLon`
as two uniforms, and evaluate the elevation per pixel. The ephemeris is never evaluated in a shader.

### 2.4 Rise, set, twilight, transit

`src/astro/riseset.ts`. Implement the **10 minute grid scan with bisection** from SOLAR 8.2, at all
latitudes (see C15).

```ts
export type EventKind = 'rise' | 'set';
export interface DayEvent { kind: EventKind; minutesUTC: number; }
export type PolarState = 'normal' | 'alwaysAbove' | 'alwaysBelow';

export interface DayEvents {
  events: DayEvent[];        // 0, 1 or 2, chronological within the UTC day
  state: PolarState;
  dayLengthMinutes: number | null;   // mod1440(set - rise) when both exist
}

export function findEvents(
  jd0: number,               // JD at 0h UT of the day
  p: GeoPoint,
  h0: number,                // -0.8333 | -6 | -12 | -18
  stepMinutes?: number,      // default 10
): DayEvents;

export function solarNoonUTC(jd0: number, lon: number): number;  // minutes UTC
```

Rules, all from SOLAR 8:

- Thresholds: **-0.8333** for sunrise and sunset, **-6 / -12 / -18** for civil, nautical and
  astronomical twilight. Document the -0.8333 choice in the UI.
- Bisect 50 times on each sign change. Sample **geometric** altitude.
- Never assume rise and set come in pairs. 70 N on 2025-05-16 has one rise and no set on the same
  UTC day.
- Day length is `mod1440(setUTC - riseUTC)` from two independently found events, never twice the
  sunrise hour angle.
- Polar wording, copied from USNO: "continuously above the horizon", "continuously below the
  horizon", "continuously above the twilight limit".
- Solar noon is the corrected two pass form
  `m = 720 - 4*lon - eot(T(jd0 + m/1440))`, iterated three times from `m = 720 - 4*lon`. Do not port
  NOAA's `calcSolNoon`, which has a half day offset bug worth up to 7 s at high longitude.
- Present rise and set to the **minute**, never to the second. Refraction variability alone is worth
  tens of seconds at mid latitude and minutes above 65 degrees.
- Do not "fix" the 12 h 06 m equinox day length at the equator. It is correct.

### 2.5 Seasons

`src/astro/seasons.ts`. Implement **Meeus chapter 27** with tables 27.B and 27.C, transcribed from
SOLAR section 9, and subtract **delta T = 69.1 s** to convert TT to UT for display.

**Never root find equinoxes on the low accuracy apparent longitude.** SOLAR measured that as wrong by
up to 11 minutes.

The hard coded USNO table for 2025 to 2027 in SOLAR TV-18 becomes a test fixture, not shipped data.

### 2.6 Analemma

`src/astro/analemma.ts`. The analemma is literally `(-0.25 * eotMinutes, declination)` in degrees
when sampled at a fixed UTC instant each day. No separate maths. SOLAR 12.2. Regression test against
the 24 row golden table in SOLAR 12.4.

---

## 3. Test vectors

Store all vectors in `tests/fixtures/solar-vectors.json`, never inline in spec files, so they can be
regenerated and diffed. Every value below is from SOLAR section 13 and was verified there against
USNO, VSOP87 or a published Meeus worked example.

### 3.1 Tolerances

| Quantity | Tolerance | Basis |
|---|---|---|
| Meeus 25.a intermediates | see per row table below | published book values |
| Subsolar latitude | 0.005 deg | 3x the 10.9 arcsec worst measured error |
| Subsolar longitude | 0.02 deg | 3x the 45.8 arcsec worst measured error |
| Equation of time | 0.15 min | 3x the 3.45 s worst measured error |
| Solar elevation (geometric) | 0.02 deg | 3x the 4 arcsec worst measured error |
| Solar azimuth | 0.05 deg, relaxed to 0.10 deg when elevation > 80 | azimuth is ill conditioned near the zenith |
| Rise, set, transit, twilight | 60 s | USNO publishes whole minutes and rounds |
| Season instants | 90 s | Meeus 27 reproduced USNO to 40 s |
| GMST | 0.001 deg | reproduces the book exactly |

### 3.2 Group A: Meeus worked examples (must pass first)

**TV-01**, input JD 2448908.5 (1992-10-13T00:00:00 TD). This is the gate: if it passes, every
polynomial coefficient is right.

| Symbol | Expected | Tolerance |
|---|---|---|
| `t` | -0.072183436 | 1e-9 |
| `L0` | 201.80720 | 1e-5 |
| `mod360(M)` | 278.99397 | 1e-5 |
| `e` | 0.016711668 | 1e-9 |
| `C` | -1.89732 | 1e-5 |
| `trueLongitude` | 199.90988 | 2e-5 |
| `R` | 0.99766 | 1e-5 |
| `lambda` | 199.90895 | 2e-5 |
| `eps0` | 23.44023 | 1e-5 |
| `eps` | 23.43999 | 1e-5 |
| `alpha` | 198.38083 | 1e-4 |
| `delta` | -7.78507 | 1e-4 |

**TV-03** GMST at 1987-04-10T00:00:00Z = 13h 10m 46.3668s = 197.6931950 deg.
**TV-04** GMST at 1987-04-10T19:21:00Z = 8h 34m 57.0896s = 128.7378730 deg.

### 3.3 Group B: subsolar point

| ID | UTC instant | lat | lon |
|---|---|---|---|
| TV-05 | 2025-01-01T00:00:00Z | -22.99820 | -179.13938 |
| TV-06 | 2025-06-21T02:42:00Z | +23.43834 | +139.94329 |
| TV-07 | 2025-06-21T12:00:00Z | +23.43783 | +0.46451 |
| TV-08 | 2025-03-20T09:01:00Z | -0.00028 | +46.59935 |
| TV-09 | 2025-09-22T18:19:00Z | -0.00000 | -96.61371 |
| TV-10 | 2025-12-21T15:03:00Z | -23.43824 | -46.18804 |
| TV-11 | 2000-01-01T12:00:00Z | -23.03243 | +0.82128 |
| TV-12 | 2030-03-20T13:52:00Z | -0.00012 | -26.14583 |

TV-11 also pins `jd === 2451545.0` and `t === 0` exactly. TV-07 is additionally the anchor for the
shader visual regression baseline (section 12.4).

### 3.4 Group C: equation of time

| ID | UTC instant | EoT (min) |
|---|---|---|
| TV-13 | 2025-02-11T02:49:41Z | -14.2284 |
| TV-14 | 2025-05-13T19:20:54Z | +3.6430 |
| TV-15 | 2025-07-25T22:32:50Z | -6.5614 |
| TV-16 | 2025-11-03T02:20:07Z | +16.4919 |
| TV-17a | 2025-04-15T12:00:00Z | +0.0348 |
| TV-17b | 2025-09-01T00:00:00Z | -0.1003 |
| TV-17c | 2025-12-25T12:00:00Z | -0.1813 |

The three zero crossings exist to catch sign errors that only appear near zero.

### 3.5 Group D: seasons, 2025 to 2027 (UT, USNO)

| Year | March equinox | June solstice | September equinox | December solstice |
|---|---|---|---|---|
| 2025 | Mar 20 09:01 | Jun 21 02:42 | Sep 22 18:19 | Dec 21 15:03 |
| 2026 | Mar 20 14:46 | Jun 21 08:24 | Sep 23 00:05 | Dec 21 20:50 |
| 2027 | Mar 20 20:25 | Jun 21 14:11 | Sep 23 06:02 | Dec 22 02:42 |

Note that the widely reproduced "2026 June solstice 08:25" is a rounding artifact. USNO returns 08:24.

### 3.6 Group E: elevation and azimuth (geometric, north based)

| ID | Location | UTC instant | alt | az |
|---|---|---|---|---|
| TV-19 | Oslo 59.9139 N, 10.7522 E | 2025-06-21T10:00:00Z | 51.00185 | 150.55033 |
| TV-20 | Oslo | 2025-12-21T11:00:00Z | 6.58999 | 176.50113 |
| TV-21 | Quito 0.1807 S, 78.4678 W | 2025-03-20T17:00:00Z | 84.69836 | 86.63127 (tol 0.10) |
| TV-22 | Quito | 2025-06-21T17:00:00Z | 66.07338 | 8.95104 |
| TV-23 | Sydney 33.8688 S, 151.2093 E | 2025-12-21T02:00:00Z | 79.46084 | 351.36553 (tol 0.10) |
| TV-24 | Sydney | 2025-06-21T01:00:00Z | 31.11522 | 15.27395 |
| TV-25 | Reykjavik 64.1466 N, 21.9426 W | 2025-09-22T13:00:00Z | 25.82978 | 174.33404 |
| TV-26 | Reykjavik | 2025-06-21T13:00:00Z | 48.99850 | 169.61035 |

TV-22 and TV-23 straddle the 0/360 azimuth wrap and will fail loudly on a south based azimuth or a
missing `+180`.

### 3.7 Group F: rise, set, twilight

| ID | Case | Assertions |
|---|---|---|
| TV-27 | Oslo 2025-06-21 | rise 01:53:46, set 20:43:56, noon 11:18:52, civil 00:09:31 / 22:28:07, **no nautical, no astronomical**, day length 18h 50m 10s |
| TV-28 | Oslo 2025-12-21 | rise 08:18:14, set 14:12:06, noon 11:15:11, civil 07:20:42 / 15:09:39, nautical 06:24:00 / 16:06:21, astro 05:32:35 / 16:57:46 |
| TV-29 | Quito 2025-03-20 | rise 11:17:55, set 23:24:25, **day length 12h 06m 31s** (catches a geometric horizon) |
| TV-30 | Sydney 2025-09-22 | set **07:51:26** then rise **19:43:38**, in that order within the UTC day. Assert the order. |
| TV-31 | Reykjavik 2025-12-21 | rise 11:22:29, set 15:29:31, day length 4h 07m 02s |
| TV-32 | Ushuaia 54.8019 S, 68.3030 W, 2025-12-21 | rise 07:51:32, set 01:10:58 next UTC day |
| TV-33 | London 2025-06-21 | rise 03:43:08, set 20:21:38, nautical present, **astronomical absent** |

### 3.8 Group G: polar cases (70 N, 0 E)

| ID | Date | Expected |
|---|---|---|
| TV-34 | 2025-06-21 | no events, `state = 'alwaysAbove'`, day length 1440, no twilight events either, noon 12:01:53, midnight elevation +3.44 |
| TV-35 | 2025-12-21 | no events, `state = 'alwaysBelow'`, day length 0, civil 09:54:32 / 14:01:52, nautical 08:05:45 / 15:50:39, astro 06:45:43 / 17:10:40 |
| TV-36a | 2025-05-15 | rise 00:37, set 23:37 |
| TV-36b | 2025-05-16 | rise 00:15, **no set** |
| TV-36c | 2025-07-29 | rise 00:57, set 23:05 |
| TV-36d | 2025-11-24 | rise 11:14, set 12:19 |
| TV-36e | 2025-11-25 | `alwaysBelow` |
| TV-36f | 2026-01-16 | `alwaysBelow` |
| TV-36g | 2026-01-17 | rise 11:41, set 12:40 |

Existence flags must match exactly. Times to 60 s.

### 3.9 Oracles, and the two you must not use

Allowed for regenerating fixtures: **USNO Astronomical Applications API v4.0.1** (`celnav`,
`rstt/oneday`, `seasons`, `siderealtime`) and **MET Norway `api.met.no/weatherapi/sunrise/3.0`** as
a second source. USNO rounds displayed minutes; MET Norway truncates. Account for that.

**Banned as oracles: SunCalc and `api.sunrise-sunset.org`.** SunCalc has altitude errors up to 10.23
arcmin and a systematic +68 to +84 s transit offset from its `J0 = 0.0009` day constant.
`api.sunrise-sunset.org` was 228 s early at Oslo in June and 5 minutes late at Reykjavik in
December. Asserting against either bakes in the wrong answer.

When querying USNO `celnav` to regenerate subsolar fixtures, pass the expected subsolar point as the
observer coordinates. USNO omits bodies below the observer's horizon and you get a missing key, not
an error.

---

## 4. Twilight colour ramps

### 4.1 Interpolation space and structure

- **Author and store the ramps in OKLCH. Bake to OKLab. Interpolate in OKLab. Convert to linear sRGB
  once per pixel.** Do not interpolate in sRGB (blue to orange passes through grey brown) and do not
  interpolate in linear sRGB (the perceptual midpoint lands at OKLab L 0.76).
- Bake all three ramps at startup in TypeScript into **one 256 x 3 RGBA16F texture**, `LINEAR` filtered,
  `CLAMP_TO_EDGE` on both axes. Row 0 = ocean, row 1 = land, row 2 = ice. The x axis maps solar
  elevation linearly from -25 at u=0 to +90 at u=1, which is 0.45 degrees per texel, well inside the
  smoothness of the curves.
- The texture stores **OKLab L, a, b** in RGB. Convert to linear sRGB in the shader with the
  Ottosson inverse matrix. Store OKLab, not sRGB, so the hardware's bilinear filter is doing a
  perceptual interpolation for free.
- Each segment is smoothstepped during the bake, not linearly ramped:
  `t = t*t*(3 - 2*t)` between adjacent stops.

**The Ottosson inverse matrix element (2,3) is `-0.3413193965`, not `-0.4413193965`.** A wrong digit
here shifts every ramp stop by about 0.02 in L and 7 degrees in hue and presents as "the ramp looks
slightly off" rather than as a bug. There is a mandatory round trip unit test in section 12.1.

### 4.2 OCEAN ramp

Sixteen stops. `hex` is the check value: regenerating from L, C, H must reproduce it.

| Elevation | OKLab L | C | H | hex |
|---:|---:|---:|---:|---|
| +90 | 0.345 | 0.080 | 250 | `#123b61` |
| +60 | 0.340 | 0.079 | 250 | `#123a5f` |
| +30 | 0.325 | 0.076 | 251 | `#113659` |
| +18 | 0.305 | 0.072 | 252 | `#0f3052` |
| +12 | 0.290 | 0.068 | 253 | `#0f2c4c` |
| +6 | 0.268 | 0.063 | 256 | `#0f2644` |
| +2 | 0.248 | 0.058 | 259 | `#0f213c` |
| 0 | 0.234 | 0.056 | 262 | `#0f1d38` |
| -2 | 0.212 | 0.058 | 267 | `#0d1733` |
| -4 | 0.192 | 0.062 | 272 | `#0b1030` |
| -6 | 0.174 | 0.064 | 276 | `#0a0b2b` |
| -9 | 0.152 | 0.062 | 278 | `#070625` |
| -12 | 0.134 | 0.052 | 280 | `#06041c` |
| -15 | 0.121 | 0.038 | 282 | `#050414` |
| -18 | 0.114 | 0.028 | 272 | `#03040f` |
| -25 | 0.112 | 0.026 | 262 | `#02040e` |

### 4.3 LAND ramp

| Elevation | OKLab L | C | H | hex |
|---:|---:|---:|---:|---|
| +90 | 0.560 | 0.056 | 101 | `#7b764f` |
| +60 | 0.552 | 0.058 | 100 | `#7a734b` |
| +30 | 0.532 | 0.062 | 97 | `#766d42` |
| +18 | 0.505 | 0.068 | 91 | `#736335` |
| +12 | 0.482 | 0.074 | 86 | `#715b28` |
| +6 | 0.445 | 0.084 | 76 | `#6e4d13` |
| +2 | 0.400 | 0.094 | 62 | `#6a3a00` |
| 0 | 0.372 | 0.098 | 53 | `#652f00` |
| -2 | 0.320 | 0.092 | 40 | `#581e06` |
| -4 | 0.272 | 0.078 | 22 | `#461315` |
| -6 | 0.232 | 0.066 | 350 | `#330d22` |
| -9 | 0.190 | 0.058 | 300 | `#180c29` |
| -12 | 0.160 | 0.048 | 284 | `#0b0921` |
| -15 | 0.140 | 0.036 | 283 | `#080717` |
| -18 | 0.130 | 0.027 | 274 | `#050612` |
| -25 | 0.127 | 0.025 | 263 | `#030711` |

### 4.4 ICE ramp

| Elevation | OKLab L | C | H | hex |
|---:|---:|---:|---:|---|
| +90 | 0.960 | 0.010 | 100 | `#f3f2eb` |
| +60 | 0.945 | 0.014 | 97 | `#efede3` |
| +30 | 0.912 | 0.022 | 90 | `#e7e2d2` |
| +18 | 0.876 | 0.032 | 82 | `#e1d5bf` |
| +12 | 0.848 | 0.040 | 76 | `#ddcab1` |
| +6 | 0.795 | 0.054 | 64 | `#d5b599` |
| +2 | 0.730 | 0.070 | 48 | `#cd9b82` |
| 0 | 0.690 | 0.076 | 40 | `#c58c78` |
| -2 | 0.610 | 0.076 | 27 | `#ac716a` |
| -4 | 0.520 | 0.070 | 6 | `#8c5863` |
| -6 | 0.440 | 0.062 | 330 | `#664663` |
| -9 | 0.345 | 0.058 | 292 | `#3a3355` |
| -12 | 0.270 | 0.050 | 283 | `#23233e` |
| -15 | 0.215 | 0.038 | 282 | `#17172a` |
| -18 | 0.188 | 0.029 | 274 | `#0f1220` |
| -25 | 0.182 | 0.026 | 263 | `#0c121e` |

### 4.5 Why these stops, and what may not be changed

- **The chroma maximum sits at -8, not -4.** Derived from Patat, Ugolnikov and Postylyakov 2006
  photometry. Hue runs roughly 250 (day cyan blue) to 262 at the terminator to 277 near -8 to 283 at
  -15, then pulls back toward neutral. Do not flatten the hue rotation.
- **The night floor is reached at -15 to -16, not -18.** Nothing changes below -16. Do not add stops
  below -18.
- **Land and ice take the short hue path** from warm to violet (53, 40, 22, 350, 300, 283). The
  intermediate stops at -2, -4, -6 and -9 exist to force it. Removing them sends the interpolation
  through green and cyan.
- **The three ramps must converge by -18.** Verify by scripting the OKLab distance between them at
  each stop; the target is dE_ok <= 0.02 at -18 and -25. If they do not converge, every coastline in
  the twilight band shows a seam.
- **The day side lift is a tunable, not a constant.** Ocean is lifted +0.06 OKLab L and land +0.04
  above the measured Apollo 17 and Himawari values. Expose both as constants in
  `src/color/ramps.ts` named `OCEAN_DAY_LIFT` and `LAND_DAY_LIFT` so they can be A/B tested.
- The measured ocean anchor to compare against, from two independent sources: Apollo 17 p05 is
  `#072045` (L 0.249, C 0.076, H 258) and a live Himawari-9 disk at +50 degrees is `#032745`
  (L 0.271, C 0.068, H 249).

### 4.6 Surface selection per pixel

```glsl
float landMask = clamp(0.5 + d / max(fwidth(d), 1e-5), 0.0, 1.0);   // d from the SDF, texels
float iceMask  = texture(uIce, uv).r;                                // 0..1, R8
vec3 lab = mix(
    mix(sampleRamp(0, elev), sampleRamp(1, elev), landMask),
    sampleRamp(2, elev),
    iceMask * landMask);
```

Ice is masked to land so that sea ice, which the Natural Earth glaciated layer does not carry, does
not produce a ring of ice colour offshore.

### 4.7 Additive terms, in linear light

Applied after the ramp, before tone handling, all additive in linear sRGB:

1. **Ocean sun glint.** GGX with `alpha = 0.20` (Cox and Munk total mean square slope at 7 m/s wind)
   and `F0 = 0.02` (water at n = 1.33). On a nadir equirectangular map the geometry collapses to
   `N.H = cos((90 - elev) / 2)`, so the glint is a pure function of solar elevation. Mask to ocean.
   Tint with the direct beam colour, which at the subsolar point is effectively white. Multiply the
   physical result by a `GLINT_GAIN` constant defaulting to 6.0, because a photometrically correct
   2 percent reflectance is invisible against the ramp.
2. **City lights.** Additive, faded in with `smoothstep(-3.0, -10.0, elev)`: nothing above -3, half
   at about -6.5, full by -10. Section 9.4.
3. **Subsolar marker.** Written above 1.0 linear so it is the only thing that blooms strongly.

### 4.8 Twilight boundary hairlines

Drawn in the same fragment shader as the gradient, from the same `elev` value (see C4):

```glsl
float hairline(float elev, float edge) {
    float w = max(fwidth(elev), 1e-4);
    return 1.0 - smoothstep(0.0, w * 0.75, abs(elev - edge));
}
```

Four edges: **-0.8333, -6.0, -12.0, -18.0**. Colour `--ink-300` equivalent (`#494e53`) at alpha 0.45,
composited over the ramp with `mix`, not added. The -0.8333 edge (apparent sunset) gets alpha 0.60;
the other three get 0.45. Exposed as a user toggle, default **on**: BEAUTY is right that the
combination of a continuous physical gradient with the four nameable thresholds drawn over it is
the project's visual identity, and that the hairline landing exactly where the gradient changes
character is what proves the gradient is real.

Also give the terminator itself a minimum smoothstep width of **0.53 degrees** of solar elevation,
which is the Sun's angular diameter and gives the 59 km physical penumbra. This is separate from the
hairline and applies to the ramp lookup near zero.

### 4.9 Tone handling and output

- **No tone map on the ramp.** ACES or Reinhard over an already authored, bounded LDR curve
  desaturates the deep blues and lifts the night floor. The only exception is a soft shoulder above
  linear 0.8 applied in the present pass, to catch bloom and glint peaks:
  `mix(c, k + (1-k)*(1 - exp(-(c-k)/(1-k))), step(k, c))` with `k = 0.8`.
- **Everything above 1.0 linear is emissive**: the subsolar marker and the brightest city light
  pixels. The ice ramp peaks at OKLab L 0.96, which is about 0.90 linear, comfortably below the
  bloom threshold, so ice caps do not bloom. This is the Stellarium headroom principle from BEAUTY
  1.3, expressed against our ramps rather than against Preetham's 0.7 clamp.
- **Encode with the exact CSS Color 4 sRGB curve, exactly once, at the very end.** Never
  `pow(c, 1/2.2)`: at a code value of 0.05 the exact inverse gives 0.003936 and `pow(0.05, 2.2)`
  gives 0.001374, a factor of 2.9, and the twilight gradient lives entirely in that region.
- **Dither immediately after the encode**, in the encoded domain:
  `encoded += (1.0/255.0) * ign(gl_FragCoord.xy) - (0.5/255.0)` with
  `ign(p) = fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))))`. Do not round those
  three constants. Taper the dither to zero in the darkest two 8 bit levels so the night side does
  not lift.
- Ship sRGB. Do not set `drawingBufferColorSpace = 'display-p3'` in v1; it changes the meaning of
  every colour constant and must be all or nothing.

---

## 5. Land, coastline and build time data assets

### 5.1 The strategy

**One full screen fragment pass driven by a build time signed distance field.** Not a rasterised
binary mask, not re-rasterised geometry per frame.

The reasoning, measured in WEBGL: an equirectangular raster stays at or above one texel per screen
pixel only while `W_tex >= zoom * backingWidth`. At 8x on a 3840 wide backing store that needs
30,720 texels, and `MAX_TEXTURE_SIZE` is **8192** on the SwiftShader that Playwright CI actually
runs. An SDF recovers sub texel crispness from a modest texture because
`clamp(0.5 + d / fwidth(d), 0, 1)` is analytically correct at any zoom.

### 5.2 Build pipeline for the SDF

Run in Node, offline, committed output. `tools/build-land-sdf.mjs`.

1. Fetch `ne_10m_land.geojson` (Natural Earth 1:10m, public domain, 4,064 polygons, 411,137
   vertices). Pin the commit.
2. Earcut it (`earcut@3`, `flatten()` then `earcut()`), asserting `deviation() < 1e-9`. Measured:
   398,928 triangles, 135 ms, max deviation 3.35e-11. **Natural Earth land is already cut at the
   antimeridian**, so no `d3-geo` preclip and no polygon clipper are needed.
3. Rasterise to an `OffscreenCanvas` at **8192 x 4096** using **one `Path2D` and one
   `ctx.fill(path, 'evenodd')` call**. Filling ring by ring double composites antialiased edges and
   leaves visible hairlines between adjacent rings.
4. Horizontally pad the mask by **1024 columns on each side** (wrapping), giving a 10240 x 4096
   grid, run the EDT, then crop the centre 8192 columns. Without this a pixel at lon +179.9 measures
   its distance to land at -179.9 as the whole width of the map, and the coastal glow breaks along
   the antimeridian.
5. Run the **Felzenszwalb and Huttenlocher exact separable EDT**, copying `mapbox/tiny-sdf`'s
   `edt`/`edt1d` verbatim along with its gamma corrected `alphaTable` seeding, which gives sub texel
   accurate zero crossings from the antialiased rasterisation. Use `Float32Array` and run node with
   `--max-old-space-size=4096`. Do not use jump flooding: it is approximate and the coastline is
   static.
6. Signed distance is `sqrt(outer) - sqrt(inner)`, with the sign convention **`d > 0` on land,
   `d < 0` in ocean**, in units of **source texels** (not kilometres, not normalised).
7. Clamp to +/- 512 texels, box downsample the distance values to **4096 x 2048**, and write IEEE
   half float bit patterns as a raw `Uint16Array` `.bin`.

### 5.3 Ice mask

`tools/build-ice-mask.mjs`. Rasterise `ne_10m_glaciated_areas` plus `ne_10m_antarctic_ice_shelves`
(both public domain) to **2048 x 1024**, apply a 3 texel Gaussian blur so the ramp transition is not
a hard edge, and write as raw `Uint8Array`.

### 5.4 City lights

`tools/build-cities.mjs`. Source: `ne_10m_populated_places` (public domain, about 7,340 features).
Write a `Float32Array` of `[worldX, worldY, brightness]` per city.

Brightness and radius follow TWILIGHT 6.2, flagged there as the weakest numbers in that document:

```
coreRadiusPx    = R0 * pow(max(pop, 1e4) / 1e6, 1/3)
peakBrightness  = B0 * pow(max(pop, 1e4) / 1e6, 0.25)
```

with `R0` and `B0` exported constants tuned against the measured Black Marble radial profile for
Tokyo (relative luminance 250, 216, 147, 68, 42, 33, 20 at r = 0, 2, 4, 6, 8, 10, 12 in 11 km
pixels). Do not treat the two exponents as facts.

### 5.5 Ramp LUT

`tools/build-ramp-lut.mjs` is optional. The LUT is small enough (256 x 3) that building it in
TypeScript at startup is preferable, because it keeps the stop tables in one place and lets the day
lift constants be changed without a rebuild. Bake it in `src/color/lut.ts`.

### 5.6 Shipped asset inventory and target sizes

| File | Format | Bytes (raw) | Notes |
|---|---|---:|---|
| `public/data/land-sdf-4096x2048.f16.bin` | `Uint16` half float | 16,777,216 | brotli precompressed sibling; expect roughly 5 to 9 MB |
| `public/data/ice-2048x1024.u8.bin` | `Uint8` | 2,097,152 | brotli sibling, expect under 200 KB |
| `public/data/cities.f32.bin` | `Float32` x3 | about 88,000 | 7,340 cities |
| `public/data/zones.topojson` | TopoJSON | 162,576 | verified figure, section 6 |
| `public/data/zone-labels.geojson` | GeoJSON points | 7,479 | 64 inner points |
| `public/data/zone-aliases.json` | JSON | 9,250 | 443 IANA ids to 64 polygons |
| fonts, inlined in CSS | base64 woff2 | 40,655 | section 7 |

Total shipped runtime payload is about **19 MB raw**, dominated entirely by the SDF. See section 15
for the fallback if that is too large.

### 5.7 Texture upload rules

Non negotiable, all from WEBGL:

- `TEXTURE_WRAP_S = REPEAT`, `TEXTURE_WRAP_T = CLAMP_TO_EDGE` on **every** equirectangular texture.
- **Never call `fract()` on a coordinate you are about to sample or pass to `fwidth()`.** It creates
  a derivative spike of magnitude 1.0 at one fragment column, the sampler drops to the lowest mip,
  and you get a pole to pole grey stripe. Pass the unwrapped coordinate and let `REPEAT` wrap.
- `texStorage2D` + `texSubImage2D`, never `texImage2D`. Some drivers allocate the whole mip chain
  unconditionally.
- `UNPACK_PREMULTIPLY_ALPHA_WEBGL = false`, `UNPACK_COLORSPACE_CONVERSION_WEBGL = gl.NONE`,
  `UNPACK_FLIP_Y_WEBGL = false` for all data textures.
- Declare `uniform highp sampler2D` for the SDF. iOS gives `lowp` samples from a float texture
  otherwise.
- The SDF is `R16F`. Not `R8` (linear R8 over +/-512 texels quantises to 4 texels and turns the coast
  to mush) and not `R32F` (`OES_texture_float_linear` is explicitly not core in WebGL2, while
  `OES_texture_half_float_linear` is).
- A unit test asserts that no texture exceeds **8192** in either dimension.

### 5.8 What the SDF unlocks

One texture fetch gives, per WEBGL 2.5: the antialiased shoreline, a coastal glow
(`exp(-max(-dPix, 0) / 6.0)` in screen pixels, so it keeps constant apparent thickness under zoom),
continental shelf shading (`smoothstep` over about 40 texels), and inland continentality
(`smoothstep(0, 120, d)`).

Scale the shelf and glow **thresholds** by `1 / max(cos(radians(lat)), 0.2)`, not the field itself.
The equirectangular grid stretches longitude by `1/cos(lat)`, which cancels out for antialiasing
(the anisotropy is locally constant and `fwidth` is measured in screen space) but does widen large
halos at high latitude.

---

## 6. Timezone data

### 6.1 Source

**`evansiroky/timezone-boundary-builder`, release tag `2026c`, asset
`timezones-with-oceans-now.geojson.zip`** (26,238,140 bytes), inner file
`combined-with-oceans-now.json`, 64 features, each carrying a real IANA `tzid`.

**Do not use Natural Earth `ne_10m_time_zones`.** It is a May 2012 CIA World Factbook derivative
frozen since 2021, its `tz_name1st` is Intl usable on only 68 of 120 features and semantically wrong
on many of those (zone 8 is labelled `Australia/Perth` while its places list begins "China, Hong
Kong"), and its `zone` field still records Moscow at UTC+4. Its only usable products are the
`map_color6` / `map_color8` adjacency colourings and, if you want a decorative nautical meridian
overlay, its 30 ocean features.

**Pin the release tag** (`releases/tags/2026c`), never `releases/latest`, so a shape change cannot
land silently.

### 6.2 Simplification

Verified end to end. `tools/build-timezones.mjs` runs, via `mapshaper@0.7.52`'s `applyCommands`:

```
-i tz.json
-filter-fields tzid
-simplify resolution=4096x2048 keep-shapes
-o format=topojson quantization=1e4 id-field=tzid zones.topojson
-points inner
-o format=geojson precision=0.01 labels.geojson
```

Measured output: `zones.topojson` **162,576 bytes** (40,032 brotli q11, 45,173 gzip -9), 1,113 arcs,
18,969 points, ids present on all 64. `labels.geojson` **7,479 bytes**.

Parameter justifications:

- **`keep-shapes` is mandatory.** Without it `Australia/Lord_Howe` (226 vertices, 0.7 degrees wide,
  7 px on a 3840 canvas), `Pacific/Norfolk` (193) and `Australia/Eucla` (432) vanish. Those are the
  most interesting features on a timezone map.
- **`resolution=4096x2048`** ties the threshold to one cell of the grid we draw on, so no removed
  vertex could have moved a pixel at 4K.
- **`quantization=1e4` and no higher.** Grid step is 0.036 degrees, 0.38 px on a 3840 canvas.
  `1e5` costs 25 percent more raw bytes for sub pixel gain.
- The TopoJSON `objects` key comes from the input filename, so `-i tz.json` gives `topo.objects.tz`.
- Precompress `.br` and `.gz` siblings at build time. Do not inline into the JS bundle.

Write a 15 line TopoJSON decoder in `src/data/topojson.ts` (multiply by `transform.scale`, add
`transform.translate`, prefix sum along each arc) rather than shipping `topojson-client`. It decodes
straight into `Float32Array` vertex buffers, which is what the GL layer wants anyway.

### 6.3 IANA mapping strategy

The mapping problem is solved by the dataset choice: every polygon already carries a correct `tzid`
and the 64 polygons are precisely the distinct current timekeeping behaviours on Earth.

Rules:

- **Offsets are integer minutes, always.** Never decimal hours. Nepal's +5:45 boundary produces a
  half pixel seam once you multiply hours by 15 degrees.
- **Label with `Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'longGeneric' })`, not the raw
  tzid.** The representative id is the most populous group member, so Oslo, Berlin, Stockholm and
  Copenhagen all live inside the polygon labelled `Europe/Paris`. `longGeneric` yields "Central
  European Time", "Nepal Time", "Chatham Time", "Lord Howe Time".
- **Validate zone ids with `try { new Intl.DateTimeFormat('en', { timeZone: id }) } catch`**, never
  with `Intl.supportedValuesOf('timeZone').includes(id)`. In ICU 78.3 `supportedValuesOf` returns 418
  ids, omits `UTC`, omits every `Etc/*`, and returns old style links (`Asia/Calcutta`,
  `Europe/Kiev`) that MDN says the spec forbids.
- **Never use `resolvedOptions().timeZone` as a canonical key.** ICU 78.3 rewrites `Asia/Kolkata` to
  `Asia/Calcutta`, `Europe/Kyiv` to `Europe/Kiev`, `Pacific/Kanton` to `Pacific/Enderbury`. Keep a
  small alias table for the handful of renames actually displayed.
- **`Etc/GMT+N` has an inverted sign.** `Etc/GMT+12` formats as `GMT-12:00`.
- Ship `zone-aliases.json` (a copy of `timezone-names-with-oceans-Now.json`) so a search box can map
  any of the 443 IANA ids onto one of the 64 drawn polygons.

### 6.4 Offset computation

`src/time/zones.ts`. Use the cached `formatToParts` route from TZ 5.1 with `hourCycle: 'h23'` and the
instant truncated to whole seconds. Constructing 63 formatters costs 13.96 ms once; formatting all
63 costs 0.038 ms per frame with `.format()`.

`src/time/transitions.ts` precomputes the per year transition table at load with the binary searched
`transitions()` helper. Measured: **58 transitions across all 63 zones for 2026, found in 275 ms**,
and only 29 of 63 zones transition at all. After that the render loop is a binary search plus an
integer add, with **zero `Intl` calls per frame**.

Define **standard time as the minimum offset the zone takes across the twelve months of the year**,
so southern hemisphere zones and Morocco's inverted Ramadan rule come out right.

Two zones in 2026 have a DST step that is not 60 minutes: `Australia/Lord_Howe` (30 minutes) and
`Antarctica/Troll` (120 minutes). Never render an hour quantised offset ruler and never label DST as
"Summer Time"; use a colour tint.

### 6.5 Wall clock to instant

`src/time/instant.ts`. Use the **Temporal style probe a day before and a day after** algorithm from
TZ 5.5, with the `'compatible'` disambiguation policy. The naive two pass offset guess silently
fails to detect the ambiguous autumn hour (verified for `Europe/Oslo` at wall time
2026-10-25 02:30).

**The scrubber's state is always a UTC instant.** Wall clock to instant conversion happens exactly
once, when the user types a date or picks a "local noon here" preset, so gaps and ambiguity never
enter the render loop.

### 6.6 Rendering the zone layer

- Paint a neutral base colour over the whole canvas before drawing polygons. 0.11 percent of the
  globe has no polygon: 68 one degree cells in the high Arctic between 73 N and 84 N near the
  antimeridian, plus one in the Weddell Sea.
- Colour by a **cyclic hue on `offsetMinutes mod 1440`**, so Kiribati's UTC+14 islands and the
  surrounding UTC-10 ocean share a hue. Add a **dashed "date differs" stroke** on any boundary where
  the two sides are on different calendar dates, since the cyclic ramp deliberately hides the 24 hour
  jump. Note the BEAUTY warning: timezone bands must not be a 24 hue rainbow. Use a low chroma
  cyclic ramp at chroma 0.03 or below.
- TBB splits polygons at the antimeridian, so the renderer needs **no antimeridian logic at all**.
- Antarctica: hatch as one region. Only `Antarctica/Troll` survives as its own polygon (a six vertex
  wedge from 0 E to 25 E) and the South Pole resolves to `Pacific/Auckland`.
- Give Lord Howe, Chatham, Eucla, Norfolk and Kathmandu off island leader line labels.
- Show the data vintage (TBB tag `2026c`) and the **ODbL licence with OpenStreetMap attribution** in
  the About panel. This is a licence requirement, not a courtesy.

---

## 7. Type and font pipeline

### 7.1 The pairing

**Pairing A, "Admiralty".** All three families are SIL OFL 1.1 with no Reserved Font Name clause.

| Role | Family | Instancing | Subset bytes |
|---|---|---|---:|
| Display | Bodoni Moda | `opsz=72`, `wght=400:700`, display charset | 12,104 |
| UI | Archivo | `wdth=100`, `wght=300:700`, instrument charset | 17,456 |
| Data | Martian Mono | `wdth=100`, `wght=300:700`, instrument charset | 11,984 |
| **Total** | | | **40,655** |

Rationale: the subject is celestial navigation, not aerospace telemetry, and Didone plus grotesque
plus wide mono is the typographic register of a chart table. It is also the smallest of the three
candidate pairings.

**Consequences that are binding:**

- **All angles are decimal degrees.** Neither Bodoni Moda nor Martian Mono has U+2032 or U+2033
  (see C16).
- **No family has U+2609 SUN.** The subsolar marker is drawn in the WebGL layer.
- **Archivo's tabular digit advance changes with weight** (556, 573, 667 units at wght 100, 500,
  900). Lock every UI numeral to a single weight.
- **The primary readout is Martian Mono**, so that separators are fixed pitch too. Measured: at 64px
  the string `12:34:56` is identical in width at weight 400 and 700 in Martian Mono, while Archivo
  grows 16.52 px and Bodoni Moda 30.09 px, even with `tabular-nums` active, because the colons are
  proportional.
- Martian Mono digits are 0.750 em, the widest in the study. `12:34:56` at 64px is 358 px. Budget the
  readout panel accordingly.
- Optically match on **x height, not font size**. Bodoni Moda x height is 0.460 em against Archivo's
  0.526 em, so Bodoni Moda at 18.3px sits alongside Archivo at 16px. Set explicit line heights
  everywhere; Bodoni Moda's hhea box is 1.525 em.

### 7.2 Pipeline

A **committed, two stage Python build step**, not part of the Vite build. Fonts do not change
between builds. `tools/build-fonts.py`, invoked by `npm run fonts`.

Stage 1, narrow the variation space (`pyftsubset` has no `--variations` option, so this is
mandatory):

```
python -m fontTools.varLib.instancer -q "Archivo[wdth,wght].ttf" wdth=100 wght=300:700 -o narrowed.ttf
```

Stage 2, subset:

```
pyftsubset narrowed.ttf --flavor=woff2 --unicodes="$LATIN_INSTRUMENT" \
  --layout-features="ccmp,locl,kern,mark,mkmk,liga,tnum,case,zero,rvrn" \
  --no-hinting --drop-tables+=DSIG --notdef-outline --recalc-bounds
```

**`tnum`, `case` and `zero` are not in `pyftsubset`'s default `--layout-features` list.** Omitting
them silently ships a font whose tabular figures do not work. This is the single most likely way to
break the numeric UI.

Source the TTFs from `raw.githubusercontent.com/google/fonts/main/ofl/<family>/<File%5Baxes%5D.ttf>`,
pinned to a commit. Do not use the css2 API: it content negotiates on User-Agent (curl's default gets
TrueType, not woff2), gstatic URLs carry rotating hashes, and the served files already have features
stripped.

Commit the `.woff2` files, the three `OFL.txt` files and a `THIRD-PARTY.md` to the repo.

Pinning the width axis is the highest leverage operation in the pipeline: Archivo goes 49,708 to
17,456 bytes, a 65 percent saving.

The pure Node alternative (`subset-font@2.5.0` over harfbuzzjs) works and was verified, but produces
25 to 45 percent larger files because it keeps every GSUB feature and performs layout closure, and it
exposes no feature allowlist. At these absolute sizes that is 9 KB, so it is a defensible fallback if
a Python dependency is unacceptable.

### 7.3 Embedding

**Inline all three fonts as base64 data URIs in the CSS.** Measured cost after brotli on the wrapping
CSS: **+0.6 to +1.0 percent**, not the feared 33 percent. Whole pairing: 40.6 KB raw, 40.6 KB base64
plus brotli.

```css
@font-face {
  font-family: 'Archivo UI';
  src: url(data:font/woff2;base64,...) format('woff2');
  font-weight: 300 700;
  font-style: normal;
  font-display: block;
}
```

- Use `format('woff2')`, not `format('woff2-variations')`. Verified working for variable fonts in
  Chromium, Firefox and WebKit.
- Generate `src/styles/fonts.generated.css` from the Python step rather than relying on Vite's
  `assetsInlineLimit`, which also affects images and was not verified.
- Drive weight with the `font-weight` property. Reserve `font-variation-settings` for custom axes
  only, and route those through a custom property.

### 7.4 The font loading trap

**`await document.fonts.ready` does not wait for base64 faces nothing has requested yet.** Verified:
Chromium and WebKit returned pure fallback metrics for all ten study families after awaiting it;
Firefox happened to work.

```ts
// src/ui/fonts.ts
const FACES = ['Archivo UI', 'Martian Data', 'Bodoni Display'] as const;
export async function ensureFonts(): Promise<void> {
  await Promise.all(FACES.flatMap((f) => [
    document.fonts.load(`400 16px "${f}"`, '0123456789:.'),
    document.fonts.load(`700 16px "${f}"`, '0123456789:.'),
  ]));
  await document.fonts.ready;
}
```

Call it before the first text measurement and before the first frame that positions a label.

### 7.5 Numeral rules

```css
.readout, .clock, .coord, .elevation, time {
  font-variant-numeric: tabular-nums slashed-zero;
  font-feature-settings: 'tnum' 1;
  font-kerning: none;
  letter-spacing: 0;
}
```

- Use `font-variant-numeric`, not `font-feature-settings` alone: the latter is all or nothing and
  clobbers unrelated features. Both are present above as belt and braces.
- `slashed-zero` exists only in Archivo (of our three). It is harmless where absent.
- **Never animate `font-weight`, `font-stretch`, `font-size`, `letter-spacing` or
  `font-variation-settings` on a live numeral.**
- Digit slots use `display: inline-block; inline-size: 1ch; overflow: hidden`. U+2007 FIGURE SPACE is
  missing from most candidate families, so the classic padding trick is unavailable.
- The digit roll animation (140 ms `translateY` on `cubic-bezier(0.2, 0, 0.38, 0.9)` plus a 220 ms
  colour flash, only on slots that changed) applies to **the primary readout and the hovered zone
  clock only**. The other 63 zone clocks update by `textContent` once per second. This caps layer
  promotion churn.
- Never roll through intermediate digits, never cross fade old and new, never put `aria-live` on a
  ticking clock.
- Micro labels: 10px, uppercase, `letter-spacing: 0.09em`, weight 500, colour `--text-3`. Use them
  only for field names, units and axes (SOLAR ELEVATION, UTC OFFSET, DECLINATION). **Never place a
  tracked uppercase label above a large heading**; that is the AI hero eyebrow tell.

---

## 8. Visual system: palette, chrome, effects

### 8.1 Tokens

Normative palette (SHELL 4.4). Every ratio measured.

```css
:root {
  --void:      #04070C;   /* page ground, deep night sea */
  --ink:       #070C13;
  --panel:     #0C141F;
  --panel-2:   #121C29;
  --hairline:  #243040;
  --text-3:    #6E8098;   /* 4.58:1 vs panel. The floor for real text. */
  --text-2:    #9DB0C6;   /* 8.33:1 */
  --text-1:    #E4ECF5;   /* 15.51:1 */
  --text-0:    #F7FAFD;   /* 17.66:1, readouts */
  --amber:     #F5B851;   /* the single accent, 10.44:1 */
  --amber-dim: #B8853A;
  --ice:       #8ED3E8;   /* reserved for the civil twilight legend swatch only */
  --alert:     #FF7A66;

  /* motion, IBM Carbon productive set */
  --t-instant:  70ms;
  --t-quick:   110ms;
  --t-base:    150ms;
  --t-weighty: 240ms;
  --t-heavy:   400ms;
  --t-scene:   700ms;
  --e-standard: cubic-bezier(0.2, 0, 0.38, 0.9);
  --e-enter:    cubic-bezier(0, 0, 0.38, 0.9);
  --e-exit:     cubic-bezier(0.2, 0, 1, 0.9);
  --e-detent:   cubic-bezier(0.3, 0, 0.1, 1);

  /* effects */
  --grain-opacity: 0.035;
  --vignette-corner: 0.38;
  --scrim-min-alpha: 0.62;
}
@media (prefers-reduced-motion: reduce) {
  :root { --t-instant:1ms; --t-quick:1ms; --t-base:1ms; --t-weighty:1ms; --t-heavy:1ms; --t-scene:1ms; }
}
```

**Never `#000000` as a ground.** `--void` is `#04070C`, which also gives the DOM grain layer
something to modulate without a visible black lift.

**Accent budget: at most three warm elements on screen at once.** The subsolar marker, the "now"
state of the scrubber, and the hovered timezone. Any second accent hue, especially cyan on dark, is
a bug.

`rgba(255,255,255,0.6)` composited on the ground loses 61 percent of the chroma of the equivalent
mixed ramp step. **Panel text over a solid scrim uses ramp tokens. Only text drawn directly onto the
live map may use white with opacity**, because there the background genuinely is an image.

### 8.2 Scrims and panels

**A scrim of `rgba(4, 7, 12, 0.62)` is the computed minimum that guarantees WCAG AA 4.5:1 for
`#E4ECF5` text over any map pixel, including a white ice cap** (worst case 0.599). Text placed
straight on the day side gets 1.00:1 to 2.13:1, that is, invisible. The scrim is load bearing, not
decorative.

```css
.rail::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(to top,
    rgb(4 7 12 / 0.92) 0%,
    rgb(4 7 12 / 0.86) 38%,
    rgb(4 7 12 / 0.42) 72%,
    rgb(4 7 12 / 0) 100%);
}
.panel {
  background: rgb(12 20 31 / 0.88);
  border-radius: 3px;
  border: none;
  box-shadow:
    inset 0 1px 0 0 rgb(255 255 255 / 0.07),
    inset 0 -1px 0 0 rgb(0 0 0 / 0.55),
    0 18px 44px -12px rgb(0 0 0 / 0.72);
}
```

Rules:

- Alpha must be at or above **0.62 anywhere a glyph lands**.
- **Asymmetric inset hairlines, not a uniform border.** A 1px border on all four sides paired with a
  diffuse shadow is a catalogued AI slop tell.
- `border-radius` 2 to 4 px. Instruments are not pills.
- **No outer glow on panels.** A panel in front of a light source is a silhouette. Glow belongs only
  on things that emit, and those live in the WebGL layer.
- Any border that carries information (a slider track, a selected state) must clear 3:1 per SC
  1.4.11. No white alpha below 0.28 reaches that, so use a real colour: `--text-3` gives 4.58:1.
- **`backdrop-filter` on at most one bounded panel**, guarded by `@supports`, with a background
  colour of at least `rgb(6 10 16 / 0.66)` because the blur contributes nothing to contrast. Measured
  cost over an animating WebGL canvas: one 420 x 520 panel is free, three panels cost +4.32 ms/frame,
  fullscreen costs +3.16 to +3.80 ms/frame. **Area is what costs; radius is essentially free.** Never
  animate the blur radius, never apply it fullscreen.

### 8.3 Grain

Two layers, per C5.

**Shader grain (the map).** Static, signed, zero mean, applied last in linear light before the sRGB
encode:

```glsl
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
color += vec3((hash12(gl_FragCoord.xy + uGrainSeed) - 0.5) * 0.012);
```

`uGrainSeed` is set once at startup and never changed. Do not reseed per frame.

**DOM grain (the chrome).** Optional, the 306 character inline SVG:

```
<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
  <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/>
  <feColorMatrix type='saturate' values='0'/></filter>
  <rect width='300' height='300' filter='url(%23n)'/></svg>
```

at `opacity: 0.035`, `mix-blend-mode: normal`.

Three measured facts that constrain this:

- **`baseFrequency: 1.0` produces a perfectly flat grey with zero variance** at every octave count,
  because the Perlin lattice period equals one device pixel. It still lifts the black level while
  contributing no texture. Stay at or below 0.85.
- **`numOctaves` above 2 gains nothing** (stdev 1.20, 1.33, 1.36 for 1, 2, 3).
- **`mix-blend-mode: overlay` and `soft-light` produce literally zero grain on pure black** and near
  zero (stdev 0.23) on a very dark panel. The standard "use overlay for film grain" advice fails
  completely here. Only `normal` works, and its price is the black lift, which is why `--void` is
  `#04070C` and not `#000000`.
- Do not use a tiled PNG. A 128 x 128 grayscale noise PNG is 26,666 bytes, more than an entire
  subsetted variable font, shows visible repetition, and measured 5x the per frame cost of the SVG.

### 8.4 Vignette

DOM layer, never applied to the map texture. A vignette on a heliograph darkens real data, so it is
weak, off centre and biased toward where the chrome sits.

```css
.vignette {
  position: fixed; inset: 0; pointer-events: none; z-index: 30;
  background:
    radial-gradient(140% 110% at 50% 46%,
      transparent 46%, rgb(2 4 8 / 0.18) 78%, rgb(2 4 8 / 0.38) 100%),
    linear-gradient(to top, rgb(2 4 8 / 0.30) 0%, transparent 22%);
}
```

Peak corner alpha **0.38** and zero alpha across the central 46 percent radius, so the terminator is
never dimmed. The 46 percent vertical centre (not 50) is what makes it read as a lens rather than a
CSS effect. The bottom linear component is separate so it can be switched off when the control rail
is hidden.

### 8.5 Bloom

Render the scene to **RGBA16F**. Bright pass at **threshold 1.0**, soft knee 0.5, then a 5 level
Jimenez pyramid: 13 tap downsample (weights: centre 0.125, four inner half texel diagonals 0.125
each, four edge 0.0625, four corner 0.03125), 9 tap tent upsample (`1/16 * [[1,2,1],[2,4,2],[1,2,1]]`),
combined progressively. Composite at **strength 0.6, radius 0.35**.

Verification: toggle bloom off. If more than the subsolar marker and a handful of megacities change,
the exposure is wrong. Bloom is only impressive when most of the frame is below threshold.

### 8.6 Cartographic taste

- **Projection: equirectangular (Plate Carree), default and only, in v1.** Under it the terminator is
  a sinusoid whose amplitude is the solar declination and the subsolar point's vertical position is
  the declination, readable off the axis. Natural Earth 1 is prettier as a static image and destroys
  that. A globe is a future mode, never a default.
- **Graticule**: exactly one device pixel. 30 degree spacing at world zoom, 10 degrees past about 4x.
  The equator, both tropics (23.44) and both polar circles (66.56) get 1.5 device pixels at 0.7
  alpha; everything else 1 device pixel at 0.35 alpha. Those five lines are the geometry of the
  subject, not decoration.
- **Country borders default off.** When enabled: half the coastline weight, dashed 2/3, 0.35 alpha,
  never across water.
- **No rivers.** They carry no solar information and turn land into texture.
- **Islands**: the SDF handles this automatically; nothing under one coarse texel (about 10 km)
  survives, which is roughly the right cut and keeps Iceland, Ireland, Sri Lanka, Tasmania, Hokkaido,
  Hawaii, Svalbard and the Falklands.
- **Layer order** (bottom to top): sky and ramp, coast glow and shelf, twilight hairlines, graticule,
  timezone borders, city lights (additive), subsolar marker (additive, above 1.0), bloom composite,
  shader grain, sRGB encode, dither. Then in DOM above the canvas: labels and clocks, panels,
  vignette, DOM grain.
- **A permanent solar elevation readout in degrees to one decimal, under the cursor, in tabular
  figures at `--text-1`.** This is not a feature, it is the credibility claim that licenses every
  visual effect on the page.

### 8.7 The anti pattern audit

Before shipping, check explicitly against BEAUTY part 3. No indigo or purple gradient. No cyan on
dark. No radial spotlight glow behind anything. No coloured `box-shadow` glow. No glassmorphism
except the one bounded `backdrop-filter` that is genuinely aiding legibility. No pulsing status dot
next to "LIVE" (the ticking tabular clock already communicates live). No three column feature grid.
No pill badge. No emoji anywhere. No `border-radius` above 10px on a panel. No bounce, elastic or
overshoot easing. No `rgba(0,0,255,0.3)` night fill. No country borders at coastline weight. No sun
as a `box-shadow: 0 0 60px orange` blob.

---

## 9. Render architecture

### 9.1 Context and canvas

```ts
const gl = canvas.getContext('webgl2', {
  alpha: true,                    // do NOT use alpha:false, it is expensive on some platforms
  antialias: false,               // we render to an FBO; MSAA on the default buffer is unused
  depth: false,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,   // measured unnecessary for Playwright screenshots
  powerPreference: 'high-performance',
  desynchronized: false,
});
```

Write `alpha = 1.0` in the base pass and use `blendFuncSeparate(src, dst, gl.ZERO, gl.ONE)` in every
overlay pass so nothing can ever reduce destination alpha and premultiplication becomes a no op.

Every fragment shader starts:

```glsl
#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
```

`mediump` is float16 and maxes at 65,504, so a Julian Day is `+inf` and a longitude of 179.99 carries
7 km of error. Reduce absolute time to a small number on the CPU before it reaches a shader.

### 9.2 Canvas sizing

`ResizeObserver` with `{ box: 'device-pixel-content-box' }` wrapped in try/catch (engines that do not
know the box name throw), falling back to `contentBoxSize * devicePixelRatio`. Never
`clientWidth * devicePixelRatio` alone: it is documented not to work reliably under browser zoom.

Cap the backing store at **3840 x 2160 total (8.29 megapixels)** and **8192 in either dimension**,
scaling proportionally beyond that. An effective DPR of 1.5 on a 5K panel is visually
indistinguishable from 2.0 for a smooth gradient map with SDF antialiased edges, and is 44 percent
fewer fragments. Expose the cap as a setting.

Apply `canvas.width` / `canvas.height` **inside** the rAF callback, never in the observer, and always
call `gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)` reading the size back from
the context, because the spec permits a smaller drawing buffer than requested.

Size the canvas with `100svh` so it never reallocates as the address bar collapses; size the chrome
layer with `100dvh` so it tracks the browser UI.

### 9.3 Pass graph

All passes render into an **RGBA16F** scene framebuffer at backing resolution, except the final
present.

| # | Pass | Geometry | Blend | Writes |
|---|---|---|---|---|
| A | Sky | one full screen triangle | none | ramp, coast glow, shelf, inland, glint, twilight hairlines |
| B | Graticule | instanced screen space quads | alpha | 1 device pixel lines |
| C | Timezone borders (toggle) | instanced screen space quads | alpha | 19k point polyline set |
| D | City lights | instanced quads, 7,340 instances | additive `(ONE, ONE)` | two lobe glow |
| E | Subsolar marker | one instanced quad | additive | values above 1.0 linear |
| F | Bright pass + 5 level bloom pyramid | full screen | none | half res chain |
| G | Present | one full screen triangle | none | scene + bloom, shoulder, grain, sRGB encode, dither, to the default framebuffer |

Pass A converts `gl_FragCoord` to world coordinates and then to lon/lat:

```glsl
uniform vec2  uRes;         // backing pixels
uniform vec2  uCentre;      // cx, cy in world units
uniform float uScale;       // z * uRes.x, backing pixels per world unit
vec2 fragToWorld() { return (gl_FragCoord.xy - 0.5 * uRes) / uScale + uCentre; }
```

World space is `x = (lon + 180) / 360` in `[0,1)`, `y = (90 - lat) / 360` in `[0, 0.5]`, so one world
unit is the same number of screen pixels on both axes and the map is naturally 2:1. Note that
`gl_FragCoord.y` grows upward while world y grows southward: negate once, in one place, and be
consistent.

Wrap around is handled **per draw call, not per vertex**: pass A needs nothing (`REPEAT` sampling and
an unnormalised `uCentre.x`), and passes B, C, D, E draw up to three copies with a `uCopyOffset`
uniform of -1, 0, +1, culled by AABB. Wrapping per vertex smears polygons across the whole map.

### 9.4 Line and sprite rendering

- **`gl.lineWidth` is dead.** Measured `ALIASED_LINE_WIDTH_RANGE = [1, 1]`. Use instanced quad
  expansion in **screen space** (project the endpoints to pixels first, extrude second) with the
  wwwtyro one buffer, two attributes, divisor 1 layout, and a 1 px feather in the fragment shader.
  Round joins for the timezone borders; skip joins entirely for the graticule, which has no bends.
- **`gl.POINTS` is banned for the city lights.** The WebGL spec states verbatim that POINTS
  primitives may or may not be discarded when the vertex lies outside the clip volume, GLES clips by
  centre while desktop GL clips by the whole quad, and `gl_PointSize` caps range from 1 to 2048
  across devices (64 on Apple M1 and M2). Use instanced quads: 7,340 instances x 6 vertices, one
  `drawArraysInstanced`.
- City glow kernel, fitted to the measured Tokyo profile:
  `exp(-2.30 * r * r) + 0.07 * exp(-0.09 * r * r)`.
- `uGlowPx` is in **backing pixels**, so multiply by the effective DPR. Cull instances outside the
  viewport on the CPU using an index sorted by world x, and shrink the glow radius at low zoom.
- Two population light palette: warm `#ffb26b` and cool `#e8eeff`, mixed per region, targeting the
  measured Black Marble aggregate of `#dacbb0`. Add a small pure orange gas flare class (`#ff7b28`)
  for the Persian Gulf, Niger delta, Bakken and western Siberia.

### 9.5 Context loss

```ts
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();              // MANDATORY: without it webglcontextrestored never fires
  cancelFrame();
  disposeAllGlHandles();
  showOverlay('Restoring graphics');
}, false);
canvas.addEventListener('webglcontextrestored', () => {
  createResources(gl);
  hideOverlay();
  markDirty();
}, false);
```

Keep every GL object behind a single `createResources(gl)` and every CPU side source of truth (the
SDF `Uint16Array`, the city list, the decoded zone arcs) in memory outside it, so restore is one call
and does not refetch 17 MB. Also handle failure to obtain a context at all.

### 9.6 Hot loop hygiene

Never call `getError`, `getParameter`, `getShaderParameter`, `checkFramebufferStatus` or `readPixels`
inside the render loop. Each is a flush plus a round trip to the GPU process. Check shader compile
status once at startup, and nothing in production.

Upload textures before drawing, never between draws.

---

## 10. Animation model

### 10.1 The three clocks

Conflating any two of these is the source of every drift bug.

1. **Wall clock**: `Date.now()` for "what instant is it", `performance.now()` for all elapsed time
   maths. Never `Date.now()` for frame deltas; it is subject to NTP corrections and can go backwards.
2. **Frame clock**: the `DOMHighResTimeStamp` argument to rAF. Frame deltas only.
3. **Simulation clock**: the Earth instant being displayed, as an **integer count of epoch
   milliseconds** in a plain `number`.

### 10.2 Closed form simulation time

```ts
export type Mode =
  | { kind: 'live' }
  | { kind: 'paused'; epochMs: number }
  | { kind: 'playing'; epochMs: number; msPerSecond: number };

export function simEpochMs(mode: Mode, wallNowMs: number, anchorWallMs: number): number {
  switch (mode.kind) {
    case 'live':    return Date.now();
    case 'paused':  return mode.epochMs;
    case 'playing': return mode.epochMs + Math.round((wallNowMs - anchorWallMs) * mode.msPerSecond / 1000);
  }
}
```

**Rule: any time you change mode, change rate, or scrub, set `epochMs` to the current sim time and
`anchorWallMs` to the current wall time, in that order.**

There is no stateful numerical integration anywhere in this app. Solar position is an analytic
function of an instant, timezone offsets are a lookup, twilight bands are a function of solar
elevation. Everything is a pure `render(simEpochMs, view)`. So the fixed versus variable timestep
question does not arise, and Gaffer's accumulator solves a problem this app does not have. The two
pieces of genuine state, pan inertia and camera easing, are also closed form (10.6).

### 10.3 Day scrub

- The scrubber maps to a **24 hour window centred on the anchor date at 00:00 UTC**.
- Speed chips: **1x, 60x, 600x, 3600x**, that is `msPerSecond` of 1,000 / 60,000 / 600,000 /
  3,600,000. At 3600x one wall second is one simulated hour, so a full day takes 24 s.
- The seconds field of the primary readout is hidden at any speed above 1x. It is meaningless there
  and it churns.
- Dragging the scrubber is **1:1 with the pointer, with zero transition**. Any transition on a
  dragged control is a bug.
- Releasing the scrubber does not animate. Only a discrete jump (the "now" button) animates, over
  400 ms with `--e-standard`.

### 10.4 Year scrub

**Year scrub advances whole days at a fixed UTC time of day.** This is a deliberate design decision,
not a simplification. It follows directly from the analemma formulation in SOLAR 12.2: sampling at a
fixed UTC instant makes subsolar longitude an affine function of the equation of time alone, so:

- The terminator stops sweeping in longitude and instead **breathes in latitude**, which is exactly
  the declination sweep the year scrub exists to show.
- The subsolar point traces the analemma directly on the map, at no extra cost.
- The polar day and polar night envelopes expand and contract legibly instead of strobing.

Rates: **1 day per second** (`msPerSecond = 86,400,000`) and **5 days per second**
(`432,000,000`). A full year at 1 day/s is 365 s, which is too long for a default; the default year
scrub rate is 5 days per second, giving a 73 s year. Offer 1 day/s for close inspection.

Mark the four season instants (from `src/astro/seasons.ts`) and the perihelion and aphelion on the
year scrubber track.

### 10.5 The scrubber track is made of the data

The scrubber's track is not a neutral bar. It is a strip rendered from the actual twilight gradient
at the cursor's current latitude for the current date, so sunrise, golden hour, blue hour and the
three twilights are visible bands inside the control itself. In year mode the track redraws as the
date changes and the band widths breathe with the seasons. Render it into a small offscreen canvas
using the same `src/color/ramps.ts` code, so it cannot drift from the map.

### 10.6 Pan and zoom

View state is `{ cx, cy, z }` with `scale = z * backingWidth`. Cursor anchored zoom keeps the world
point under the cursor fixed:

```ts
const [wx, wy] = screenToWorld(v, W, H, px, py);   // sampled at the OLD scale
const z = clamp(v.z * factor, zMin, 8);
next.cx = wx - (px - W / 2) / (z * W);
next.cy = wy - (py - H / 2) / (z * W);
next.cx -= Math.floor(next.cx);
next.cy = clampY(next, H);
```

`zMin = max(1, H / (0.5 * W))`, `zMax = 8`. Latitude clamps, longitude wraps. Use d3's wheel delta
normalisation and register the wheel listener with `{ passive: false }`.

Use Pointer Events with `setPointerCapture` so a drag survives the cursor leaving the canvas, and
convert client coordinates to backing pixels with the same DPR used to size the canvas.

**Inertia is a closed form ease, not per frame friction.** MapLibre's verified constants:
`linearity 0.3`, `deceleration 2500`, `maxSpeed 1400`, `bezier(0, 0, 0.3, 1)`, velocity measured over
a 60 ms window with a 160 ms buffer cutoff, and the window ending **at release** rather than at the
last recorded move, so a gesture held still before release has no inertia. Cap the fling distance in
**world units**, not screen pixels, or an 8x fling crosses a quarter of the planet.

### 10.7 The loop

```ts
function frame(frameNowMs: number) {
  rafId = 0;
  applyResize();
  const sim = simEpochMs(mode, performance.now(), anchorWallMs);
  const animating = mode.kind === 'playing' || inertia.active() || camera.easing();
  if (dirty || animating || sim !== lastRenderedSim) {
    dirty = false; lastRenderedSim = sim;
    render(sim, view);                 // GL passes AND DOM label transforms, same callback
    frameCounter++;
  }
  if (animating || dirty) rafId = requestAnimationFrame(frame);
}
export function markDirty() { dirty = true; if (!rafId) rafId = requestAnimationFrame(frame); }
```

- **When nothing is animating, stop scheduling frames entirely.** Do not run a permanent rAF loop
  that early returns; that still wakes the compositor every 16 ms.
- In `live` mode, schedule a `setTimeout` to the next second boundary rather than a continuous rAF.
  The subsolar point moves 15 arcseconds per second of time, which is invisible.
- `markDirty()` is called by: pointer input, wheel, keyboard, resize, mode change, scrub, settings
  change, `webglcontextrestored`, and `visibilitychange` to visible.
- **DOM label transforms are written inside the same rAF callback as the GL draw.** That is what
  guarantees register (C11).
- Expose `window.__heliograph = { framesRendered }` for the test harness.

### 10.8 Background tabs

On `visibilitychange` to hidden while playing, convert to `paused` with the current sim time. On
return to visible, restore `playing` and **re anchor `anchorWallMs = performance.now()`**. That re
anchor is the whole point: without it, a user who backgrounds a year long animation for an hour comes
back to next August.

In `live` mode do nothing on hide. The sim clock is derived from the wall clock, so it stays correct
by construction and the first visible frame lands at the right time.

### 10.9 Load sequence

Total budget **under 900 ms** from first paint to fully interactive looking. Ordering follows
physical dependency: ground, then light, then instrumentation, then chrome.

| Step | Starts | Duration | What | Easing |
|---|---:|---:|---|---|
| 0 | 0 | 0 | `--void` painted. Fonts already present (base64), so no FOUT to hide. | |
| 1 | 0 | 700 | Map canvas `opacity` 0 to 1 **and** the shader's exposure uniform 0 to 1, so the terminator resolves out of blackness rather than the plate brightening uniformly | `--e-enter` |
| 2 | 180 | 400 | Graticule and coast glow fade in, from the shader | `--e-enter` |
| 3 | 320 | 240 | Subsolar marker scales 0.7 to 1 and fades in. The only scale animation in the app. | `--e-enter` |
| 4 | 420 | 240 | Control rail and panels, `opacity` 0 to 1 plus `translateY(8px)` to 0, **all at once, not staggered** | `--e-enter` |
| 5 | 560 | 220 | Primary readout digits, opacity only, no movement, no roll. **The clock is correct from the first frame it is visible; it never counts up from zero.** | `--e-enter` |
| 6 | 780 | 110 | Faint legends and micro labels to `--text-3` | `--e-enter` |

Nothing travels more than 8 px, nothing scales more than 2 percent, no element bounces, and
individual controls are never staggered.

### 10.10 Reduced motion

Two layers, because a blanket `* { animation: none }` reset would kill a harmless digit roll while
saying nothing about the actual vestibular hazard, which is the continuously redrawing map.

**Layer 1**: substitute all duration tokens to **1ms** (not `0s`, so `transitionend` still fires and
no state machine gets stuck), and set `transform: none` on panels.

**Layer 2**, per motion class:

| Motion | Reduced motion behaviour |
|---|---|
| Real time terminator creep | Keep it, but drop to **one redraw per second** via `setInterval`, with no rAF loop when idle. Correct and imperceptible, and no longer an animation in the SC 2.2.2 sense. |
| Day or year playback | Keep it (user initiated, so "starts automatically" does not apply), but **never autoplay on load** and **halve the default rate**. Offer step controls (step one hour, step one day) as the non animated equivalent. |
| Decorative motion | There is none by construction. Grain and dither are static, there is no pulse, no shimmer, no marker breathing. |

Independently of the media query, **SC 2.2.2 requires a visible, keyboard reachable pause control
whenever playback is running, plus a speed control.** `Space` toggles play.

Also honour `prefers-reduced-transparency` by dropping the one `backdrop-filter` and raising the
scrim alpha, and `prefers-contrast: more` by promoting `--text-3` to `--text-2` and raising the panel
hairline alpha from 0.07 to 0.20.

---

## 11. Layout shell and responsive behaviour

### 11.1 Viewport and root

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
```

`viewport-fit=cover` is what makes `env(safe-area-inset-*)` non zero. `interactive-widget=resizes-content`
makes the layout viewport shrink when the on screen keyboard appears rather than scrolling the page
under a keyboard you cannot see. Do not set `user-scalable=no` or `maximum-scale=1`.

```css
html, body { block-size: 100%; margin: 0; overflow: hidden; overscroll-behavior: none; background: var(--void); }
#map { position: absolute; inset: 0; touch-action: none; block-size: 100svh; }
#shell {
  position: fixed; inset: 0; display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: auto 1fr;
  grid-template-areas: 'top top' 'aside map' 'scrub scrub';
  pointer-events: none;
}
#shell > * { pointer-events: auto; }
```

`pointer-events: none` on the grid with `auto` on children is the important trick: it lets the map
receive drag and wheel events through the gaps between panels.

Safe areas, always with the `0px` fallback (without it the whole declaration is invalid on engines
that do not know the variable):

```css
:root {
  --gutter: clamp(12px, 1.6vw, 28px);
  --safe-l: max(var(--gutter), env(safe-area-inset-left, 0px));
  /* ... t, r, b likewise */
}
```

Landscape phones are the case that bites: the notch moves to the side, so `safe-area-inset-left` and
`-right` become non zero, and a map app gets rotated to landscape constantly.

### 11.2 Breakpoints

Break on layout capability, not device names.

- **Console, >= 1440 px**: 56 px top rail (title, primary readout, settings), a **fixed 320 px** left
  dossier (subsolar point, declination, equation of time, rise/set, day length), 88 px full width
  scrub rail. Fixed, not a percentage: at 4K the map takes the slack and shows more map, not bigger
  buttons. Raise base font size 16 to 17 px above 2560 px. Cap chrome width at 2400 px with
  `margin-inline: auto`, on the chrome layer only, never on the canvas.
- **Desk, 900 to 1439 px**: dossier becomes a toggleable 320 px overlay drawer, default closed.
- **Tablet, 600 to 899 px**: no drawer by default; three values (subsolar lat/lon, UTC, local) move
  into the top rail as one tabular line. Speed chips drop.
- **Phone, < 600 px**: 44 px top readout, full bleed map keeping at least 60 percent of the vertical,
  a full width 44 px scrubber row, and a 52 px control row. The map gets 83 percent of the height at
  390 x 844.

Touch targets: **44 x 44 CSS px minimum** under `@media (pointer: coarse)`, not the WCAG 2.5.8
minimum of 24. Expand the 4 px scrubber track's hit area with `::before { inset: -20px 0 }`.

### 11.3 Drop order

Drop from the bottom of this list first: map timezone labels and the permanent dossier at 1440 px;
equation of time, declination and the rise/set table at 900 px; speed chips at 900 px; 15 degree
graticule and city labels at 768 px; separate day and year modes at 600 px; hover local time at
600 px; the seconds field at 390 px (and at any width when speed > 1x); the app title at 390 px.

**Never drop**: the full bleed map, the pause control while playing, the current date and time in
some form, or keyboard access to the scrubber (arrows step, Home and End jump, Space plays).

---

## 12. Test strategy

### 12.1 Unit tests (Vitest, no browser)

Everything that is pure maths lives in a module with no GL and no DOM dependency and is tested in
Node.

| Suite | What is asserted |
|---|---|
| `astro/solar.spec.ts` | All of section 3 groups A, B, C, E against `tests/fixtures/solar-vectors.json`. TV-01 first: it is the gate on every polynomial coefficient. |
| `astro/riseset.spec.ts` | Groups F and G. Assert **event order** in TV-30 and **existence flags** in TV-36, not just times. |
| `astro/seasons.spec.ts` | Group D, Meeus 27 against the USNO table, 90 s tolerance, TT to UT conversion applied. |
| `astro/analemma.spec.ts` | The 24 row golden table from SOLAR 12.4. |
| `astro/angles.spec.ts` | Property test: `wrap180` and `mod360` on 10,000 random inputs including negatives; assert `-190` wraps to `170`, not `-190`. |
| `color/oklab.spec.ts` | **Mandatory**: round trip at least 100 random sRGB colours through `linearSrgbToOklab` then `oklabToLinearSrgb` with tolerance 1e-4. A `-0.4413` typo fails this immediately. |
| `color/srgb.spec.ts` | The exact CSS Color 4 transfer functions. Assert `linearToSrgb(0.003936) ~= 0.05` and that `pow(c, 1/2.2)` is **not** used (a source grep test is acceptable here). |
| `color/ramps.spec.ts` | Every stop regenerates its published hex. Adjacent stop dE_ok within the published range. **Ocean, land and ice converge to dE_ok <= 0.02 at -18 and -25.** |
| `color/lut.spec.ts` | The baked 256 x 3 LUT reproduces each stop at its exact elevation to 1e-3 in OKLab. |
| `app/view.spec.ts` | Property test: for 1,000 random `(view, px, py)`, `worldToScreen(view, screenToWorld(view, px, py))` returns `(px, py)` to 1e-9. Cursor anchored zoom keeps the world point fixed. `clampY` at both poles and when the map is shorter than the viewport. |
| `app/clock.spec.ts` | `simEpochMs` is a pure function of elapsed wall time. Re anchoring on mode change preserves the displayed instant exactly. A simulated one hour background gap in `playing` mode does not jump after re anchor. |
| `app/inertia.spec.ts` | MapLibre's `calculateEasing` reproduces its published outputs; a gesture held still for 200 ms before release yields zero inertia. |
| `time/zones.spec.ts` | `tzOffsetMinutes` for Europe/Oslo (120 / 60), Asia/Kathmandu (345), Pacific/Chatham (825 / 765), Australia/Lord_Howe (660 / 630), Antarctica/Troll (0 / 120), America/St_Johns (-150 / -210). The `% 24` hour guard. `Etc/GMT+12` formats as GMT-12:00. |
| `time/instant.spec.ts` | The full TZ 5.5 matrix: `Europe/Oslo` 2026-03-29 02:30 yields **0** instants, 2026-10-25 02:30 yields **2**, 2026-07-01 12:00 yields **1**. Lord Howe's 30 minute gap and ambiguity. Chatham. Pacific/Apia's skipped day. |
| `time/transitions.spec.ts` | 58 transitions across the 63 zones for 2026; only 29 zones transition; the two non 60 minute steps are Lord Howe and Troll; Casablanca goes backwards in February. |
| `gl/limits.spec.ts` | **No shipped texture exceeds 8192 in either dimension.** This documents the SwiftShader ceiling in code rather than in a red CI run. |
| `tools/edt.spec.ts` | Build step test in Node: rasterise a known 100 px circle, run the EDT, assert the distance at sample points matches the analytic answer to within half a texel. Then run it on a shape that straddles the antimeridian and assert the wrap is correct. This catches wrap and sign bugs before they reach a shader. |
| `data/topojson.spec.ts` | The hand written decoder reproduces `topojson-client`'s `feature()` output on the shipped file, and all 64 ids are present. |

### 12.2 Build step tests (Node, run in CI on the committed artifacts)

- `zones.topojson` is 64 features, every one has an `id` that `Intl.DateTimeFormat` accepts.
- Lord Howe, Norfolk, Eucla, Chatham and Kathmandu are all present with non zero area.
- Ray cast every one degree cell centre: at least 64,700 of 64,800 covered.
- The SDF file is exactly `4096 * 2048 * 2` bytes and its value range is within +/- 512.
- The city file length is a multiple of 12 and every longitude is in `[-180, 180)`.

### 12.3 E2E tests (Playwright, behaviour not pixels)

Config: `args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']`,
`deviceScaleFactor: 1`, `viewport: 1280 x 720`.

| Test | Assertion |
|---|---|
| WebGL smoke | `UNMASKED_RENDERER_WEBGL` contains `SwiftShader` and `MAX_TEXTURE_SIZE >= 8192`. Fails loudly if a CI image change silently drops SwiftShader, rather than producing a black canvas and a confusing diff. |
| Boot | `window.__heliograph.framesRendered >= 2` within 5 s; no console errors; `document.fonts.check('16px "Martian Data"')` is true. |
| Idle | After 3 s idle with reduced motion off and mode `paused`, `framesRendered` has not increased. Proves the loop actually stops. |
| Pan | Drag 200 px right, assert the reported centre longitude moved by the expected amount and wrapped correctly across the antimeridian. |
| Cursor anchored zoom | Wheel over a known lon/lat, assert the lon/lat under the cursor is unchanged to 1e-6. |
| Scrub | Drag the scrubber, assert the displayed UTC readout matches the scrubber position; assert no transition delay (the readout updates within one frame). |
| Play and pause | Space starts and stops playback; the pause control is focusable and reachable by keyboard; `framesRendered` grows while playing and stops on pause. |
| DST correctness | Freeze the clock at 2026-10-25T00:30:00Z and assert the Europe/Paris polygon's clock reads 02:30 and the London polygon reads 01:30. Freeze at 2026-03-29T00:30:00Z and assert Paris reads 01:30 (before the gap). |
| Polar wording | Freeze at 2025-06-21, hover 70 N 0 E, assert the dossier says "continuously above the horizon" and shows no rise or set time. |
| Context loss | `WEBGL_lose_context.loseContext()` then `restoreContext()`; assert the app recovers and `framesRendered` resumes within 2 s. |
| Reduced motion | With `prefers-reduced-motion: reduce` emulated, assert playback does not autostart and that the idle redraw is at 1 Hz. |
| Contrast | Sample the composited pixels behind the readout text on a noon day side view and assert the computed contrast ratio is at least 4.5:1. |

Freeze the clock with `page.addInitScript` (which runs before any page script) setting
`window.__HELIOGRAPH_TEST__ = { fixedEpochMs, disableInertia: true }`. Wait on the frame counter with
`waitForFunction`, never a fixed sleep.

### 12.4 Visual regression (Playwright screenshots)

`preserveDrawingBuffer: false` is correct: three consecutive `locator.screenshot()` calls on a WebGL2
canvas produced byte identical PNGs in all four combinations of `preserveDrawingBuffer` and
`deviceScaleFactor`.

Options: `scale: 'device'` (the default `'css'` downscales away exactly the DPR bugs this renderer is
most at risk of), `animations: 'disabled'`, `maxDiffPixelRatio: 0.001`, `threshold: 0.15`. Screenshot
the canvas locator, not the page.

Baselines, all at a frozen sim clock:

| Baseline | Instant | Why |
|---|---|---|
| `equinox-noon` | 2026-03-20T12:00:00Z | Straight terminator, both poles in twilight |
| `june-solstice` | **2025-06-21T12:00:00Z** (TV-07, subsolar 23.43783 N, 0.46451 E) | Anchors the terminator to a verified test vector. Any future refactor of the shader uniforms is caught here. |
| `december-solstice` | 2025-12-21T15:03:00Z | Southern extreme, Antarctic polar day |
| `midnight-utc` | 2026-03-20T00:00:00Z | Terminator crosses the antimeridian. **Catches the `fract()` seam bug.** |
| `zoom-8x-coast` | Norwegian coast at z=8 | Proves the SDF edge stays crisp at maximum zoom |
| `city-lights-asia` | 2026-01-15T16:00:00Z | The city light fade band across east Asia |
| `dither-on` | equinox noon, dither enabled | A test that fails if someone removes the dither. The dither is a deterministic function of `gl_FragCoord`, so it is stable. |
| `timezones-on` | equinox noon, zone layer enabled | Lord Howe and Chatham must be visible |
| `phone-390` | equinox noon at 390 x 844 | Layout regression |

Commit baselines per platform. Playwright names snapshots `{test}-{browser}-{platform}.png`. Generate
CI's baselines in CI, or in the same container image.

### 12.5 What is deliberately not tested

- Absolute colour fidelity against a reference photograph. The ramps encode design judgement (the day
  side lift) as well as measurement.
- Frame rate. It is machine dependent and SwiftShader is not representative. Do performance work with
  a manual `--use-angle=gl` run.
- SunCalc or `api.sunrise-sunset.org` parity. See 3.9.

---

## 13. Project layout

```
solar/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  playwright.config.ts
  eslint.config.js                  # includes the no-local-Date-getters rule
  THIRD-PARTY.md                    # OFL, ODbL/OSM, Natural Earth, tiny-sdf, MapLibre
  docs/
    research/                       # the six scout notes plus this spec
  tools/                            # Node and Python, run offline, output committed
    build-fonts.py
    build-land-sdf.mjs
    build-ice-mask.mjs
    build-cities.mjs
    build-timezones.mjs
    lib/
      edt.mjs                       # tiny-sdf's Felzenszwalb EDT, verbatim, BSD-2-Clause
      earcut-land.mjs
      raster.mjs
  public/
    data/
      land-sdf-4096x2048.f16.bin (+ .br)
      ice-2048x1024.u8.bin (+ .br)
      cities.f32.bin
      zones.topojson (+ .br, .gz)
      zone-labels.geojson
      zone-aliases.json
    fonts/
      OFL-BodoniModa.txt  OFL-Archivo.txt  OFL-MartianMono.txt
  src/
    main.ts
    types.ts
    astro/
      julian.ts        # julianDayFromMillis, julianCentury, calendar conversions
      angles.ts        # mod360, wrap180, deg/rad, clamp
      solar.ts         # the twelve step chain, subsolar point, elevation, azimuth
      sidereal.ts      # Meeus 12.4 GMST, GHA
      riseset.ts       # grid scan solver, solar noon, polar state
      seasons.ts       # Meeus 27 tables 27.B and 27.C
      analemma.ts
      refraction.ts    # NOAA piecewise fit, used ONLY for a displayed elevation
    time/
      instant.ts       # possibleInstants, zonedWallTimeToUTC, 'compatible' policy
      zones.ts         # tzOffsetMinutes, standardOffsetMinutes, isDST, longGeneric labels
      transitions.ts   # per year transition table, binary search
      format.ts        # tabular formatting, no local-time getters
    color/
      srgb.ts          # exact CSS Color 4 transfer functions
      oklab.ts         # Ottosson forward and inverse (element (2,3) is -0.3413193965)
      ramps.ts         # the three 16 stop OKLCH tables plus the day lift constants
      lut.ts           # bakes the 256 x 3 RGBA16F LUT
      tokens.ts        # the palette, mirrored from tokens.css for the shader and canvas
    data/
      topojson.ts      # 15 line decoder into Float32Array
      loaders.ts       # fetch + decode SDF, ice, cities, zones
      graticule.ts     # procedural meridian and parallel generation
    gl/
      context.ts       # creation, attributes, loss and restore
      resources.ts     # createResources(gl), the single restore entry point
      program.ts       # compile, link, uniform cache
      textures.ts      # texStorage2D helpers with the mandatory pixelStorei settings
      buffers.ts
      framebuffer.ts   # RGBA16F scene target, bloom chain
      passes/
        sky.ts
        graticule.ts
        zoneBorders.ts
        cityLights.ts
        subsolar.ts
        bloom.ts
        present.ts
      shaders/
        common.glsl        # precision block, world transform, sRGB, OKLab, IGN
        sky.frag.glsl
        line.vert.glsl  line.frag.glsl
        sprite.vert.glsl sprite.frag.glsl
        bloom-down.frag.glsl  bloom-up.frag.glsl
        present.frag.glsl
        fullscreen.vert.glsl
    app/
      state.ts         # Mode, View, Settings, the single store
      clock.ts         # simEpochMs, anchoring, live tick scheduling
      view.ts          # worldToScreen, screenToWorld, clampY, zoomAt
      input.ts         # pointer, wheel, keyboard
      inertia.ts       # MapLibre closed form ease
      loop.ts          # markDirty, frame, visibilitychange
      settings.ts      # persisted toggles: hairlines, zones, city lights, glint, DPR cap
    ui/
      shell.ts         # the grid, safe areas, breakpoints
      fonts.ts         # ensureFonts
      rail.ts          # top rail
      dossier.ts       # left panel
      scrubber.ts      # day and year, track rendered from the ramp
      readout.ts       # primary UTC readout
      digits.ts        # per slot change detection and roll
      zoneClocks.ts    # 64 DOM clocks, positioned in the rAF callback
      cursorInfo.ts    # solar elevation under the cursor
      about.ts         # data vintage, licences, accuracy statement
    styles/
      tokens.css
      fonts.generated.css   # written by tools/build-fonts.py
      shell.css
      panels.css
      readout.css
      effects.css      # vignette, DOM grain
  tests/
    fixtures/
      solar-vectors.json
      analemma-2025.json
    unit/            # mirrors src/
    e2e/
    visual/
      __screenshots__/
```

---

## 14. Ordered build plan

Each phase ends with something runnable and something tested. Do not proceed until the phase's tests
are green.

**Phase 1. Scaffold.** Vite + TypeScript, strict mode, Vitest, Playwright with the SwiftShader flags,
ESLint with the banned local time getters rule. The WebGL smoke E2E test passes.

**Phase 2. Astronomy core.** `astro/angles.ts`, `astro/julian.ts`, `astro/solar.ts`,
`astro/sidereal.ts`. Land TV-01 first, then groups B, C, E. Nothing else starts until TV-01 is green.

**Phase 3. Rise, set, seasons, analemma.** `astro/riseset.ts` (grid scan only), `astro/seasons.ts`,
`astro/analemma.ts`. Groups D, F, G green, including event order and polar existence flags.

**Phase 4. Colour core.** `color/srgb.ts`, `color/oklab.ts` (with the mandatory round trip test),
`color/ramps.ts`, `color/lut.ts`. Assert every stop regenerates its hex and that the three ramps
converge by -18.

**Phase 5. Build tools.** `tools/build-land-sdf.mjs` with the circle and antimeridian EDT tests,
`tools/build-ice-mask.mjs`, `tools/build-cities.mjs`, `tools/build-timezones.mjs`,
`tools/build-fonts.py`. Commit all artifacts. Run the build step tests from 12.2.

**Phase 6. GL foundation.** Context creation with loss and restore, `createResources`, the resize
observer with the DPR cap, the texture helpers with the mandatory `pixelStorei` settings, the frame
counter, and a full screen pass that outputs a flat colour. Assert the 8192 texture limit test.

**Phase 7. The sky pass.** Load the SDF and ice mask, wire the subsolar uniforms, sample the ramp
LUT, blend by land and ice masks, output through the present pass with the exact sRGB encode and the
IGN dither. This is the first frame that looks like the product. Land the `equinox-noon`,
`june-solstice` and `midnight-utc` visual baselines here, and check the antimeridian seam explicitly.

**Phase 8. Camera.** View state, pan with pointer capture, cursor anchored zoom, latitude clamp,
longitude wrap, closed form inertia. Property tests for the transform round trip, E2E for pan and
zoom. Land `zoom-8x-coast`.

**Phase 9. Clock and animation.** `app/clock.ts`, `app/loop.ts`, day scrub, year scrub with the fixed
UTC time of day rule, speeds, `visibilitychange` re anchoring, the idle stop. E2E for idle, play,
pause and scrub.

**Phase 10. Twilight hairlines, glint, coast glow, shelf.** All in the sky pass. Toggles in settings.

**Phase 11. Line layers.** Graticule with the five emphasised lines, then the timezone borders from
the decoded TopoJSON. Instanced screen space quads with feather, round joins for the borders.

**Phase 12. City lights and bloom.** Instanced quads with the two lobe kernel, the elevation fade,
the two population palette, then the RGBA16F target and the 5 level bloom pyramid at threshold 1.0.
Verify by toggling bloom: only the subsolar marker and megacities may change. Land
`city-lights-asia`.

**Phase 13. Type and shell.** Inline the fonts, `ensureFonts`, the token CSS, the grid shell with
safe areas and breakpoints, the scrims, the panels, the vignette, the DOM grain. Land `phone-390` and
the contrast E2E test.

**Phase 14. Readouts and clocks.** Primary readout in Martian Mono with per slot digit rolls, the
cursor solar elevation readout, the dossier, the 64 zone clocks positioned in the rAF callback with
`longGeneric` labels, the precomputed transition table. E2E for DST correctness and polar wording.

**Phase 15. Scrubber.** The track rendered from the actual twilight gradient, season markers on the
year track, keyboard access (arrows, Home, End, Space), the pause and speed controls required by SC
2.2.2.

**Phase 16. Motion, reduced motion, load sequence.** Wire the Carbon tokens, implement the sub 900 ms
load sequence, implement both reduced motion layers plus `prefers-reduced-transparency` and
`prefers-contrast`. E2E for reduced motion.

**Phase 17. About panel and attribution.** Data vintage (TBB 2026c, Natural Earth version, tzdata via
`Intl`), the ODbL and OpenStreetMap attribution, the OFL notices, the accuracy statement (h0 =
-0.8333, times to the minute, model accuracy figures from SOLAR section 10).

**Phase 18. Audit and freeze.** Run the BEAUTY part 3 anti pattern checklist explicitly. Grep the
whole repo for em dashes and en dashes. Grep for `pow(` with `2.2`. Verify no shipped texture exceeds
8192. Verify zero network requests at runtime with the devtools network panel on a cold load. Tune
`OCEAN_DAY_LIFT`, `LAND_DAY_LIFT`, `GLINT_GAIN`, grain amplitude and vignette corner on a calibrated
display, then freeze them.

---

## 15. Risks and open items

Carried forward from the scout notes, plus risks this spec creates.

1. **The SDF is 16.8 MB raw and dominates the payload.** If the offline budget cannot absorb it, the
   fallback ladder is: (a) clamp the distance range to +/- 256 texels, which improves brotli ratio;
   (b) drop to 3072 x 1536 (9.4 MB); (c) drop to 2048 x 1024 (4.2 MB) and accept losing coastline
   features narrower than about 20 km. Do **not** switch to an RGBA8 hi/lo PNG encoding: bilinear
   filtering across a hi byte step interpolates the two bytes independently and produces garbage.
2. **The equirectangular metric distortion in the SDF at high latitude is unverified.** The cos(lat)
   threshold scaling is argued, not measured. Look at a 40 texel shelf halo at 70 N before trusting
   it.
3. **`Float32Array` precision for the padded EDT is argued from the mantissa, not measured.** Squared
   distances up to 6e8 are the concern. The circle test in phase 5 should be run at full grid size
   once, not only on a small shape.
4. **The city brightness and radius exponents are unsourced.** `pop^(1/3)` for radius and `pop^0.25`
   for brightness are fitted only to one Tokyo profile. If megacities look absurd, this is the first
   place to look, and a literature search for a peer reviewed VIIRS radiance to population law is
   worth twenty minutes.
5. **All Intl findings are verified only on V8 with ICU 78.3.** Firefox and Safari canonicalisation
   behaviour, whether `Antarctica/Mirny` throws there, and whether their `supportedValuesOf` includes
   `Etc/*` are all unknown. The spec's rule of validating by try/catch and never trusting
   `resolvedOptions().timeZone` is the mitigation, but the E2E DST tests should run in all three
   engines.
6. **SwiftShader is reportedly unavailable on macOS arm64.** If a contributor develops on an M series
   Mac, the visual regression project needs a separate Playwright config, and their baselines will
   not match CI's.
7. **All backdrop-filter timings are from one Intel Arc 140T at 72 Hz.** The relative ordering (area
   costs, radius does not) should hold, but the absolute +3 to +4 ms fullscreen figure must be re
   measured on a mid range Android and an older iPhone before any frosted element ships to touch.
8. **The absolute lightness of the Himawari anchor is an underestimate** by an unknown NICT scaling
   factor. Hue and relative ordering are trustworthy; the day side lift constants are therefore
   partly compensating for that, and they are the largest single aesthetic decision in the ramp.
9. **TBB 2026a introduced a deliberate polygon overlap** between America/Los_Angeles and
   America/Vancouver. Whether 2026c still contains overlaps anywhere is unchecked. If it does, the
   zone renderer needs a deterministic draw order rule.
10. **`-points inner` label anchors follow polygon area**, so Africa/Abidjan's anchor lands in the
    South Atlantic. Budget for roughly a dozen hand tuned label position overrides.
11. **The digit roll animation is specified but not built or measured.** Verify that per slot change
    detection across the primary readout does not cause layer promotion churn over the WebGL canvas,
    particularly during fast scrubbing.
12. **Real safe area inset pixel values were not verified on hardware.** Test on a notched device in
    both orientations before shipping the phone layout.
13. **Every effect constant is a starting value**: grain 0.012 shader and 0.035 DOM, vignette corner
    0.38, bloom strength 0.6 radius 0.35, glint gain 6.0, the day side lifts, and the whole load
    sequence timeline. Tune them on a calibrated display in phase 18, then freeze them as constants
    with a comment saying they were tuned by eye.
14. **The hairline width heuristic `fwidth(elev) * 0.75` is untested at 8x zoom**, where the elevation
    gradient per pixel is eight times smaller. If the hairlines thin out or disappear at high zoom,
    clamp the width to a minimum in screen pixels rather than in degrees.
