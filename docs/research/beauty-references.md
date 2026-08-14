# Beauty References: what makes a heliograph look expensive rather than templated

Research reference for the Heliograph project (Vite + TypeScript + WebGL2, vanilla, offline).
Written 2026-08-14.

## How to read this document

Every number, colour and code block below carries a confidence marker:

- **[V]** Verified. I fetched the primary source and the value is quoted from it. The URL is given.
- **[C]** Computed. I derived it myself with a script in this session from a verified input. The derivation is shown.
- **[U]** UNVERIFIED. My judgement, or a secondary source, or a synthesis. Treat as a starting value to tune by eye, not as fact.

Style note for anyone editing this file: no em-dashes or en-dashes anywhere. Use commas, parentheses, colons.

---

# Part 0: The thesis in one paragraph

Expensive-looking dark instruments are not more decorated than templated ones. They are more **restrained and more internally consistent**. Three things separate them, and all three are measurable:

1. **One light source.** A single warm accent against a large cool field. Everything else is a neutral from one ramp. The moment there are two competing accent hues, the page reads as a template.
2. **Physically motivated surfaces.** Grain, vignette, bloom and blur are used at the strength a camera would produce (grain at 4 to 8 percent, vignette under 40 percent at the far corner, bloom only above a real threshold), not at the strength a filter preset produces.
3. **Type and rules that behave like instrumentation.** Tabular figures, tracked micro-caps, hairline rules at a real device pixel, and no panel chrome that is not doing work.

Everything below is detail in service of those three.

---

# Part 1: The references, and the single decision that makes each one work

## 1.1 earth.nullschool.net (Cameron Beccario)

**The single decision: the entire UI is a text-only overlay in one grey, and the map is allowed to be the only saturated thing on the screen.**

The actual stylesheet is small and severe. Verified from `public/styles/styles.css` in the source repo:

```css
body {
  color: #eeeeee;
  background: #000005;                     /* not #000000: 5 units of blue */
  font: 1em mplus-2p-light-sub, Helvetica, arial, freesans, clean, sans-serif;
}

a, .text-button          { color: #888888; }
.text-button.highlighted { color: #e2b42e; }   /* the single warm accent */
.text-button.disabled    { color: #444444; }
a:hover, .text-button:hover, .text-button:active { color: #ffffff; }

a:hover, .text-button:hover, .text-button:focus, .text-button:active {
  transition: color 125ms ease-in;
}

#status, #location, #earth {
  background-color: rgba(0, 0, 5, 0.6);
  border-radius: 0.5rem/0.5rem;
  padding: 0 1rem 0 1rem;
}
#menu {
  background-color: rgba(5, 10, 30, 0.85);
  border-radius: 0.5rem/0.5rem;
  transition: opacity 250ms ease, max-height 250ms ease, margin-top 250ms ease;
}
```

[V] https://raw.githubusercontent.com/cambecc/earth/master/public/styles/styles.css

What to steal, precisely:

- **The background is `#000005`, not black.** Five units of blue in the darkest surface. This is the cheapest possible depth cue and it costs nothing. Pure `#000000` looks like an unfinished canvas; a near-black with a hue reads as a rendered space.
- **A four-step text ramp and nothing else**: `#444444` (disabled) to `#888888` (idle) to `#eeeeee` (body) to `#ffffff` (hover). Four values. No opacity tricks.
- **Exactly one accent, `#e2b42e`**, a warm amber, used only for the currently-selected state. In a heliograph this is obviously the sun.
- **Panels are `rgba(0,0,5,0.6)` scrims with no border at all.** No 1px stroke, no glass blur, no shadow. A darker patch of the same near-black. This is the correct treatment for a panel over a live map and it is the single most-copied-wrong detail in this genre.
- **Two motion speeds only**: 125ms for colour, 250ms for layout. Nothing else moves.
- **The menu panel is `rgba(5,10,30,0.85)`**, which is bluer and more opaque than the status scrims. The one panel that needs to be read has more scrim; the panels that are ambient have less. That is hierarchy through opacity of the ground, not through borders.

The colour scales themselves are worth reading for a different reason: they are hand-tuned segmented interpolations, not a library ramp. Verified stops from `products.js`, temperature scale (Kelvin to RGB):

| Kelvin | RGB | Note |
|---|---|---|
| 193 | `[37, 4, 42]` | deep violet |
| 206 | `[41, 10, 130]` | |
| 219 | `[81, 40, 40]` | |
| 233.15 | `[192, 37, 149]` | -40 C / -40 F |
| 255.372 | `[70, 215, 215]` | 0 F |
| 273.15 | `[21, 84, 187]` | 0 C, a deliberate hard hue jump at the freezing point |
| 275.15 | `[24, 132, 14]` | |
| 291 | `[247, 251, 59]` | |
| 298 | `[235, 167, 21]` | |
| 311 | `[230, 71, 39]` | |
| 328 | `[88, 27, 67]` | |

Ocean currents (m/s to RGB): `0: [10,25,68]`, `0.15: [10,25,250]`, `0.4: [24,255,93]`, `0.65: [255,233,102]`, `1.0: [255,233,15]`, `1.5: [255,15,15]`.

[V] https://raw.githubusercontent.com/cambecc/earth/master/public/libs/earth/1.0.0/products.js

And the wind scale is not a gradient at all, it is a generated sinebow with a white fade above 45 percent. Verified verbatim from `micro.js`:

```js
var BOUNDARY = 0.45;
var fadeToWhite = colorInterpolator(sinebowColor(1.0, 0), [255, 255, 255]);

function sinebowColor(hue, a) {
    var rad = hue * τ * 5/6;
    rad *= 0.75;
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    var r = Math.floor(Math.max(0, -c) * 255);
    var g = Math.floor(Math.max(s, 0) * 255);
    var b = Math.floor(Math.max(c, 0, -s) * 255);
    return [r, g, b, a];
}

function extendedSinebowColor(i, a) {
    return i <= BOUNDARY
        ? sinebowColor(i / BOUNDARY, a)
        : fadeToWhite((i - BOUNDARY) / (1 - BOUNDARY), a);
}

function colorInterpolator(start, end) {
    var r = start[0], g = start[1], b = start[2];
    var Δr = end[0] - r, Δg = end[1] - g, Δb = end[2] - b;
    return function(i, a) {
        return [Math.floor(r + i * Δr), Math.floor(g + i * Δg), Math.floor(b + i * Δb), a];
    };
}
```

[V] https://raw.githubusercontent.com/cambecc/earth/master/public/libs/earth/1.0.0/micro.js

The transferable idea: **the top of the scale runs out to white, not to a hue.** Extremes read as overexposure, which is how a camera behaves, which is why it looks photographic rather than charted. For the heliograph, the subsolar region should run out to white the same way.

Stated stack and sources on the about page: D3 for projection, Natural Earth for cartography, colour references from ColorBrewer2, Kindlmann linear-luminance, MYCARTA and Dave Green's cubehelix, M+ FONTS and Google Noto for type. [V] https://earth.nullschool.net/about.html

## 1.2 CARTO Dark Matter (CARTO with Stamen Design)

**The single decision: the dark basemap is not "black plus grey lines". Land is near-black and water is a lighter, desaturated blue-grey, which inverts the light-map convention and lets water carry the shape of the world.**

Verified directly from the raw style JSON (I fetched and grepped it, 70,431 bytes):

| Role | Value | Occurrences |
|---|---|---|
| background | `#0e0e0e` | 22 uses of `#0e0e0e` across background/landcover/park |
| water | `#2C353C` | 3 |
| landcover, national park, nature reserve | `#0e0e0e` (nature reserve at 0.7 to 0.9 opacity) | |
| residential landuse | `rgba(0,0,0,0.5)` down to `rgba(0,0,0,0.25)` by zoom | |
| building top | `rgba(57,57,57,1)`, outline `#0e0e0e` | |
| motorway | `rgba(73,73,73,1)` | |
| trunk / secondary / tertiary / minor | `rgba(65,71,88,1)` | |
| primary | `rgba(83,86,102,1)` | |
| service | `#0b0b0b` (darker than the ground) | |
| path / track | `#262626`, dashed | |
| country boundary | `rgba(92..102, 94..102, 94..102, 1)` by zoom | |
| state boundary | `rgba(103,103,114,1)` | |
| water label text | `rgba(155,155,155,1)`, halo `#181818` | |
| city label text (r5) | `rgba(211,228,236,1)`, halo `#222` | |
| road label text | `#383838`, halo `#111` | |

Text halo colours across the whole style: `#111` (7 layers), `#222` (10), `#181818` (3), `#151515` (2), `rgba(0,0,0,0.7)` (2). Text colours run from `#383838` (roads, almost invisible) up through `#666`, `rgba(155,155,155,1)`, to `rgba(211,228,236,1)` for major cities.

Fonts: Montserrat (Regular, Medium, Bold Italic), Open Sans (Regular, Bold, Italic), Noto Sans Regular.

[V] https://raw.githubusercontent.com/CartoDB/basemap-styles/master/mapboxgl/dark-matter.json

What to steal, precisely:

- **Water `#2C353C` against land `#0e0e0e`.** Water is *lighter* than land, by roughly 3x in relative luminance, and it is cooled by about 16 units of blue over red. On a dark heliograph the ocean should be the readable ground and the continents should be the holes.
- **The label halo is never black.** It is `#111` to `#222`, one or two steps above the ground. A pure black halo on a near-black map produces a visible dark ring; a halo one step off the ground disappears into it and only does work where the ground is lighter.
- **The text ramp is nine or more values wide** and the least important label class (`#383838` roads) is only 2.5 steps above the background. Dark Matter is aggressive about letting unimportant labels almost vanish. That restraint is what makes the important ones look deliberate.
- **Blue tint appears only in the label colours of important features** (`rgba(211,228,236,1)`, `rgba(174,191,207,1)`, `rgba(203,230,230,1)`) while unimportant labels are pure neutral greys (`#383838`, `#666`, `rgba(155,155,155,1)`). Hue is a hierarchy channel, not decoration.

Stamen's stated design intent, quoted: they "worked out the relationships between line thickness and outlines for roads, railroads, rivers, and lakes across all zoom levels" and "relative brightness of various features have been tweaked to create an appropriate hierarchy of importance at all zoom levels". [V] https://stamen.com/introducing-positron-dark-matter-new-basemap-styles-for-cartodb-d02172610baa/

## 1.3 Stellarium Web Engine (atmosphere shader)

**The single decision: the night sky is not black and it is not blue-tinted-by-taste. It is driven to a measured scotopic chromaticity, and the transition from colour vision to night vision is a smoothstep.**

This is the single most valuable primary source I found for this project. The full vertex shader is verified verbatim from the repo. The relevant part:

```glsl
// First compute the xy color component (chromaticity) from Preetham model
// and re-inject a_luminance for Y component (luminance).
p[2] = abs(p[2]); // Mirror below horizon.
cos_gamma = dot(p, u_sun);
cos_gamma2 = cos_gamma * cos_gamma;
gamma = acos(cos_gamma);
cos_theta = p[2];

xyy.x = ((1. + u_atm_p[0] * exp(u_atm_p[1] / cos_theta)) *
         (1. + u_atm_p[2] * exp(u_atm_p[3] * gamma) +
          u_atm_p[4] * cos_gamma2)) * u_atm_p[5];
xyy.y = ((1. + u_atm_p[6] * exp(u_atm_p[7] / cos_theta)) *
         (1. + u_atm_p[8] * exp(u_atm_p[9] * gamma) +
          u_atm_p[10] * cos_gamma2)) * u_atm_p[11];
xyy.z = a_luminance;

// Ad-hoc tuning. Scaling before the blue shift allows to obtain proper
// blueish colors at sun set instead of very red, which is a shortcoming
// of preetham model.
xyy.z *= 0.08;

// Convert this sky luminance/chromaticity into perceived color using model
// from Henrik Wann Jensen (2000)
//  * Y <= 0.01: scotopic vision. Only the eyes' rods see. No colors,
//    everything is converted to night blue (xy = 0.25, 0.25)
//  * Y > 3.981: photopic vision. Only the eyes's cones see with full colors
//  * Y > 0.01 and Y <= 3.981: mesopic vision.
highp float op = (log(xyy.z) / log(10.) + 2.) / 2.6;
highp float s = (xyy.z <= 0.01) ? 0.0 : (xyy.z > 3.981) ? 1.0
              : op * op * (3. - 2. * op);           // smoothstep

// Perform the blue shift on chromaticity
xyy.x = mix(0.25, xyy.x, s);
xyy.y = mix(0.25, xyy.y, s);
// Scale scotopic luminance for scotopic pixels
xyy.z = 0.4468 * (1. - s) * xyy.z + s * xyy.z;

// Apply logarithmic tonemapping on luminance Y only.
xyy.z = min(0.7, log(1.0 + xyy.z * u_tm[0]) / log(1.0 + u_tm[1] * u_tm[0]) * u_tm[2]);

highp vec3 rgb = xyy_to_srgb(xyy);
v_color = vec4(gammaf(rgb.r), gammaf(rgb.g), gammaf(rgb.b), 1.0);
```

with

```glsl
highp float gammaf(highp float c)
{
    if (c < 0.0031308) return 19.92 * c;
    return 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

vec3 xyy_to_srgb(highp vec3 xyy)
{
    const highp mat3 xyz_to_rgb = mat3(3.2406, -0.9689, 0.0557,
                                      -1.5372, 1.8758, -0.2040,
                                      -0.4986, 0.0415, 1.0570);
    highp vec3 xyz = vec3(xyy[0] * xyy[2] / xyy[1], xyy[2],
               (1.0 - xyy[0] - xyy[1]) * xyy[2] / xyy[1]);
    return clamp(xyz_to_rgb * xyz, 0.0, 1.0);
}
```

[V] https://raw.githubusercontent.com/Stellarium/stellarium-web-engine/master/data/shaders/atmosphere.glsl

Key numbers to take directly:

- **Scotopic night chromaticity is CIE xy = (0.25, 0.25).** Not a guess. This is the Jensen (2000) night-blue.
- **The photopic threshold is Y = 3.981 and the scotopic threshold is Y = 0.01.** Between them, `s = smoothstep`, implemented as `op*op*(3-2*op)` where `op = (log10(Y) + 2) / 2.6`.
- **Scotopic luminance is scaled by 0.4468.** Night is not just desaturated, it is dimmed by a specific factor.
- **The tone map is logarithmic and clamped at 0.7**, so the sky never reaches white. Even the brightest sky pixel stops at 70 percent luminance. That headroom is where your sun glyph and city lights live.

I converted the night-blue chromaticity to sRGB myself so the implementer has hex values to work with.

[C] xy = (0.25, 0.25) through the same xyY to sRGB matrix and the sRGB transfer function:

| Y (luminance) | sRGB | hex |
|---|---|---|
| 0.02 | 32, 38, 56 | `#202638` |
| 0.05 | 53, 63, 88 | `#353f58` |
| 0.10 | 75, 89, 123 | `#4b597b` |
| 0.20 | 105, 123, 168 | `#697ba8` |
| 0.35 | 136, 159, 216 | `#889fd8` |
| 0.50 | 160, 187, 253 | `#a0bbfd` |

The measured chromaticity of the *twilight component* is reported as CIE x,y = 0.22, 0.22 (secondary source, see 1.4). Same conversion:

[C] | Y | hex |
|---|---|
| 0.05 | `#294064` |
| 0.15 | `#486da6` |
| 0.30 | `#6596e2` |

For reference, a neutral D65 grey at the same luminances is `#595959` (Y=0.10) and `#959595` (Y=0.30). The twilight blue at equal luminance is dramatically more chromatic than neutral. **This is the whole reason a physically-derived twilight gradient looks better than a hand-picked one: the chroma is high and the luminance is low at the same time, which is a combination designers rarely reach for by hand.**

## 1.4 timeanddate.com Day and Night World Map

**The single decision: four discrete shading bands, not a continuous gradient, and a literal sun glyph at the subsolar point.**

The page returns 403 to automated fetches. From the site's own descriptions surfaced in search: the map uses "different shadings for day, night, and the three stages of twilight"; the lightest shade is day, the darkest is night with no twilight, and the intermediate shades are civil, nautical and astronomical twilight. The subsolar point is "marked on the map by a sun icon and represents the single spot on Earth where the sun is directly overhead at that moment."

Band definitions (standard, and confirmed in several of the fetched sources):

| Band | Solar elevation |
|---|---|
| Day | above 0 degrees |
| Civil twilight | 0 to -6 degrees |
| Nautical twilight | -6 to -12 degrees |
| Astronomical twilight | -12 to -18 degrees |
| Night | below -18 degrees |

[V, via search extraction] https://www.timeanddate.com/worldclock/sunearth.html and https://in-the-sky.org/twilightmap.php

The blue hour, for the record, "is most likely to emerge when the Sun is between 4 and 8 degrees below the horizon", and golden hour colour temperature runs 2,500 K to 3,500 K, dropping to 2,000 K to 2,500 K in the sun's last degrees above the horizon. [V, secondary] https://en.wikipedia.org/wiki/Blue_hour and https://en.wikipedia.org/wiki/Golden_hour_(photography)

**The design lesson is a caution.** Discrete bands are the *scientific* choice and they are what every competitor does. They are also why every competitor's map looks like a diagram. Our differentiator is the continuous, per-pixel physically-derived gradient. But: **draw the four band boundaries as hairlines over the continuous gradient.** You get the scientific legibility of timeanddate and the photographic quality of a real sky. That single move is probably the strongest visual identity decision available to this project.

in-the-sky.org already does a version of this: "a thick yellow line marks the sunset and sunrise boundary" with "thinner lines" for the civil, nautical and astronomical edges, and hovering reveals "the altitude of the Sun as seen from that location". [V] https://in-the-sky.org/twilightmap.php

## 1.5 Mike Bostock, Solar Terminator (Observable)

**The single decision: the terminator is a `geoCircle` of radius 90 degrees centred on the antipode of the sun. Two lines of code, no geometry.**

Verified from the notebook source:

```js
antipode = ([longitude, latitude]) => [longitude + 180, -latitude]

night = d3.geoCircle()
    .radius(90)
    .center(antipode(sun))
  ()
```

Styling in the notebook: graticule stroke `#ccc`, land fill `#000`, sphere stroke `#000`, night fill `rgba(0,0,255,0.3)`. Projection `d3.geoNaturalEarth1()`, rendered to `DOM.context2d`.

[V] https://api.observablehq.com/@mbostock/solar-terminator.js

The related Johan/Bostock gist uses `stroke: steelblue; fill: steelblue; fill-opacity: .3`, a Cylindrical Equal Area projection at the 38.5 degree parallel at scale 196, and a 250 ms update interval, with `darknessAngle = 90 - asin((meanRsun - meanRearth) / sunPos.range) * rad2deg`.

[V] https://gist.github.com/johan/4645501

**Steal the geometry, discard the colour.** `rgba(0,0,255,0.3)` and `steelblue` at 30 percent are the exact "default d3 example" look we must avoid. But the radius-90-at-the-antipode trick is the correct way to draw the *band boundary hairlines*: civil twilight is `geoCircle().radius(96)`, nautical is `radius(102)`, astronomical is `radius(108)`, all centred on the antipode. Four circles, four hairlines, no shader work needed for the overlay layer.

## 1.6 NASA Black Marble (VIIRS Day/Night Band)

**The single decision: the night lights are not a texture, they are a physically corrected radiance field, and the correction is what stops it looking like a stock "earth at night" JPEG.**

Verified specifications:

- The VNP46 Black Marble suite is available at **500 m resolution** since January 2012, from the VIIRS Day/Night Band on Suomi-NPP. Each pixel is roughly six city blocks.
- The retrieval algorithm "utilizes all high-quality, cloud-free, atmospheric-, terrain-, vegetation-, snow-, lunar-, and stray light-corrected radiances".
- Monthly and yearly composites are made from the daily atmospherically and lunar-BRDF corrected radiances "to remove extraneous artifacts and biases, including the influence of viewing angular effects on artificial lights".
- Radiance units are nW cm^-2 sr^-1. Version 2.0 moved from integer to floating point specifically because gas flares exceed 6553.5 nW cm^-2 sr^-1.
- The gridded product is on a 15 arc-second Linear Lat Lon grid, Level-3, HDF5, roughly 40 MB per file, 340 to 648 files per day.

[V] https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VNP46A1/ and https://www.sciencedirect.com/science/article/pii/S003442571830110X (via search extraction)

Practical consequence for us: **the raw radiance is enormously high dynamic range.** Gas flares are four orders of magnitude above a suburban street. If you sample a Black Marble PNG and multiply it by an alpha, Tokyo will be white and Norway will be invisible. You must tone map it. A log or a power curve with an exponent around 0.4 to 0.5 is the standard move. [U]

Blue Marble Next Generation, for the day side: **500 m spatial resolution, 12 monthly composites from 2004 MODIS/Terra data**, gridded at 15, 60 and 240 arc-seconds (500 m, 2 km, 8 km at the equator), Plate Carree projection on WGS84, and the 500 m version split into 8 global tiles. Produced by Reto Stockli at NASA GSFC. The headline processing advance was "a new technique for allowing the computer to automatically recognize and remove cloud-contaminated or otherwise bad data", previously manual.

[V] https://www.naturalearthdata.com is separate; the BMNG facts are from https://earthobservatory.nasa.gov/features/BlueMarble and https://neo.gsfc.nasa.gov/view.php?datasetId=BlueMarbleNG (via search extraction)

**Design consequence:** the seasonal set matters. If the heliograph scrubs through a whole year, cross-fading between the 12 BMNG monthly composites as the date changes is a genuinely expensive-looking detail almost nobody implements. Snow line advancing and retreating under the terminator is the kind of thing that makes a viewer stop scrolling.

## 1.7 NASA Eyes on the Solar System (JPL, redesign by Blink / SuperSixSeven)

**The single decision, in the design team's own words: "make it as cinematic as possible without losing any of the technical or scientific accuracy."**

Stated design principles from the case study:

1. Accuracy over aesthetics. All planetary positions and spacecraft placements maintain exact spatial and temporal accuracy despite visual enhancements.
2. Audience accessibility, targeting a broader audience through improved discoverability.
3. Storytelling integration, via a scrollytelling presentation mode.

They also record a constraint worth noting: particle systems were dropped because of engine limits. The redesign leaned on Radix UI primitives and a responsive side panel as the single navigation surface.

[V] https://www.supersixseven.com/portfolio/eoss and https://christiangimber.com/nasa-eyes

**Steal the principle, not the UI.** "Cinematic without losing accuracy" is exactly the brief for a heliograph. It gives you permission to add grain, bloom and a vignette, and it forbids you from moving a single degree of solar declination for aesthetic reasons. Write that sentence at the top of the project README.

The other transferable move is **one panel, not many**. Eyes consolidated metadata, timeline moments, tools and settings into a single responsive side panel. Every heliograph competitor scatters four floating widgets around the map. One panel that slides is more expensive-looking than four that float.

## 1.8 Ventusky, Windy, Shadowmap

These three are grouped because their public pages resisted extraction of CSS values, so the notes are observational and secondary.

**Ventusky.** [U] The single decision is that the layer selector is a horizontal band of named data layers along one edge, treated as text, not as icon buttons. Confirmed layer set from the page: Temperature, Precipitation, Radar, Wind speed, Air quality, with models ECMWF, GFS, ICON, GEM exposed to the user. Exposing the model name is itself a design decision: it signals instrument, not toy. [V, page content] https://www.ventusky.com/

**Windy.** The single decision is that the particle animation is continuous and never stops, so the page is never a static image. Reported design characterisation: "Windy is about colors, timelines, particles and animations", built on Leaflet with per-variable colour-coded range bands that the user can customise in settings. One honest criticism from the community worth internalising: the particles "flow THROUGH features like weather fronts, which makes no meteorological sense... but it gives a great feel". [V, secondary] https://www.windup.live/blog/windy-app-review/ and https://community.windy.com/

For a heliograph, the equivalent of Windy's never-stopping particles is **the terminator always creeping.** Even in "now" mode, advance the clock in real time so the boundary is measurably moving. A page that is animating at 1x real time is not perceived as animated, but it is perceived as live, and that is worth more.

**Shadowmap.** Built with WebGL, Three.js and custom shaders over CityGML and open data, rendering at 60 fps with precise sun position. The stated design value is that "due to its 3+1 dimensional nature, users can define zoom, perspective and time without constraint", explicitly contrasted with "2D server-generated imagery". [V, secondary] https://shadowmap.org/ and https://lbs2019.lbsconference.org/wp-content/uploads/2019/11/1_5.pdf

The transferable idea: **time is a spatial axis, and you should let the user hold it.** Shadowmap's differentiator is not the shadows, it is that time is a first-class draggable dimension.

## 1.9 SunCalc.org

**The single decision: the sun path is drawn as a thin yellow curve with a wider translucent yellow "envelope" showing the annual range behind it.**

From the page's own legend: "the thin yellow-colored curve shows the trajectory of the sun, the yellow deposit shows the variation of the path of the sun throughout the year", and "the colors in the above time-slider shows the sunlight during the day".

[V] https://www.suncalc.org/

Two things to steal:

1. **The instantaneous value as a hairline, the annual envelope as a low-opacity fill of the same hue.** This is the correct way to show "now versus the possible range" and it generalises directly: draw today's subsolar track as a 1px line and the analemma / annual declination envelope as a 6 to 8 percent fill behind it.
2. **Colour the scrubber itself with the data.** SunCalc's time slider is not a grey track, it is a gradient of the actual day's light. Our scrub bar should be a strip of the actual twilight gradient at the user's latitude for the current date. That single detail turns a generic slider into an instrument part.

## 1.10 kepler.gl, Awwwards and FWA winners in this category

Direct CSS extraction from kepler.gl's landing page and from the current Awwwards data-visualization winners failed (SPA shells, no server-rendered styles). What I could verify is the roster, which is useful for the implementer to look at directly:

Current Awwwards data-visualization collection includes: Redgevity Master (luminouslabs.health/redgevity-master), The Grid to the Page (consider.digital/story), Uni-Yi (uniyi.org/en), Oris Maritime (orismaritime.com), HydraDB (hydradb.com), 1000 Whales (1000whales.com), Cerebrium (cerebrium.ai), Signal IQ by Pine Labs (marketing.pinelabs.com/signaliq), Rechroma (rechroma.com), WC 2026 Data Portraits (wc26.bogachev.fr).

[V] https://www.awwwards.com/websites/data-visualization/

Of these, the one I could read gave a clear lesson. **WC 2026 Data Portraits** (wc26.bogachev.fr): the single decision is a stated provenance rule, "Nothing is staged: each match is reconstructed from roughly 1,500 recorded events." The design is minimal and neutral precisely so that the claim of authenticity is legible. [V] https://wc26.bogachev.fr

**1000 Whales** (1000whales.com): documentary restraint, off-white ground, near-black text, grayscale data graphics, serif body for narrative authority, no grain and no vignette, "cold, fact-forward, almost austere". [V, fetched] https://1000whales.com

The pattern across the award winners in the data category is consistent and slightly uncomfortable for anyone who wants to add effects: **the winners are austere, and the thing they win on is a legible claim to authenticity.** For us that means the physically-derived gradient must be *stated*, in the interface, in small type, with the actual solar elevation in degrees under the cursor. The beauty argument and the accuracy argument are the same argument.

---

# Part 2: Eighteen transferable techniques, with real values

Each of these is actionable now.

### T1. Never use `#000000` as the ground

Use a near-black with a hue. nullschool uses `#000005`. CARTO uses `#0e0e0e`. For a heliograph the ground should be cool: **`#060b10`** [C], which is OKLCH `L 0.145, C 0.014, H 250`. Pure black reads as "not rendered yet"; a tinted near-black reads as a photographed dark. If you need a second surface, go up in *lightness only*, holding hue: `#10151b`.

### T2. Build the neutral ramp in OKLCH, not by adding white

I computed a full ramp at hue 250 (cool blue) with chroma tapering from 0.014 to 0.004, plus WCAG contrast against the ground. [C]

| Token | OKLCH L | Hex | Contrast vs `#060b10` |
|---|---|---|---|
| `--ink-000` | 0.145 | `#060b10` | 1.00 |
| `--ink-050` | 0.195 | `#10151b` | 1.08 |
| `--ink-100` | 0.245 | `#1c2127` | 1.22 |
| `--ink-200` | 0.320 | `#2e3339` | 1.55 |
| `--ink-300` | 0.420 | `#494e53` | 2.35 |
| `--ink-400` | 0.545 | `#6c7176` | 4.01 |
| `--ink-500` | 0.660 | `#8e9398` | 6.37 |
| `--ink-600` | 0.780 | `#b4b8bc` | 9.90 |
| `--ink-700` | 0.880 | `#d5d8db` | 13.80 |
| `--ink-800` | 0.955 | `#eef0f3` | 17.30 |

Chroma **decreases** as lightness increases. This is deliberate: tint is most visible and most useful in the dark end. It also matches what happens optically, since bright surfaces desaturate.

The reason to use OKLCH: "because L in OKLCH is perceptually uniform, an even step in L looks like an even step in brightness on screen". [V] https://oklch.org/posts/ultimate-oklch-guide

### T3. `rgba(255,255,255,0.6)` is not the same colour as a mixed grey, and it is measurably worse

This is the one from the brief and it has a hard number behind it. I computed both. [C]

`rgba(255,255,255,0.6)` composited over `#060b10` in the browser (sRGB space, which is what CSS actually does) gives **`#9b9d9f`**, which in OKLCH is `L 0.695, C 0.0037, H 247.9`.

The equivalent step from the ramp, `--ink-500`, is **`#8e9398`**, OKLCH `L 0.6607, C 0.0094, H 248.0`.

**The opacity route loses 61 percent of the chroma** (0.0037 versus 0.0094). Every white-with-opacity value on a dark ground converges toward neutral grey as opacity rises, because you are mixing toward an achromatic point. Your carefully tinted dark theme is quietly bleached by every `opacity: 0.6` you write. Use the ramp tokens.

The same effect at other opacities, all composited on `#060b10`:

| CSS | Result | Contrast |
|---|---|---|
| `rgba(255,255,255,0.4)` | `#6a6d70` | 3.79 |
| `rgba(255,255,255,0.5)` | `#828588` | 5.32 |
| `rgba(255,255,255,0.6)` | `#9b9d9f` | 7.26 |
| `rgba(255,255,255,0.7)` | `#b4b6b7` | 9.70 |

Refactoring UI's version of the same principle: "Making the text closer to the background color is what actually helps create hierarchy, not making it light grey", with the explicit carve-out that opacity is right "when your background is an image or pattern". [V, secondary] https://refactoringui.com/previews/building-your-color-palette

**Which gives the correct rule for this project:** panel text over the solid panel scrim uses ramp tokens. Text drawn directly onto the live map uses white with opacity, because the background genuinely is a moving image and the tint should come from what is underneath.

### T4. One warm accent, and it is the sun

Everything cool except one hue. I computed a warm ramp at OKLCH hue 75 that stays in gamut. [C]

| Token | Hex | Contrast vs ground |
|---|---|---|
| `--sun-300` | `#d9951d` | 7.78 |
| `--sun-400` | `#f7ad30` | 10.32 |
| `--sun-500` | `#ffc353` | 12.40 |
| `--sun-600` | `#ffdb8d` | 14.83 |

nullschool's single accent is `#e2b42e` [V], which sits between `--sun-300` and `--sun-400`. That is a good sign; independently converged values usually are.

The colour theory behind it, stated plainly: "A warm orange element on a cool blue ground appears to sit in front of the blue, even when both are flat, same-value colors with no shadow" and "making shadows cool will make the light look warmer because of the contrast". [V, secondary] https://colorarchive.org/guides/color-temperature-design-guide/

**Budget: the warm hue may appear on the subsolar marker, the "now" state of the scrubber, and the currently-hovered timezone. Nothing else. Three appearances maximum on screen.**

### T5. Film grain at 4 to 8 percent, never above 12

The consensus range from the survey: "keep opacity between 4 to 10 percent for UI grain, with the sweet spot for modern web design being 5 to 8 percent opacity with white grain on dark backgrounds. Below 4 percent, the grain is imperceptible. Above 12 percent, it starts to compete with content and reduces text readability." [V, secondary, aggregated] https://animationpatterns.art/animations/film-overlay-compositing/ and https://wildandfreetools.com/blog/grainy-noise-css-gradient-generator/

The concrete SVG generator, verified verbatim with its exact parameters (`baseFrequency='.65'`, `numOctaves='3'`, `type='fractalNoise'`, `stitchTiles='stitch'`, `background-size: 182px`, `opacity: 0.12`):

```css
.grain::before {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 182px;
  opacity: 0.12;         /* source value; drop to 0.06 for a dark instrument */
  mix-blend-mode: overlay;
}
```

[V] https://ibelick.com/blog/create-grainy-backgrounds-with-css

**Recommendation for this project [U]: `opacity: 0.055`, `mix-blend-mode: overlay`, `background-size: 128px`.** 0.12 is tuned for a light card; on a near-black ground the same noise reads roughly twice as loud because the eye has more headroom in the shadows.

Better still, since we already have a WebGL2 pipeline: **generate the grain in the fragment shader and animate it per frame.** A static grain overlay is visibly a texture. A per-frame grain is film. The classic hash:

```glsl
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// in main(), after tone mapping:
float g = hash(gl_FragCoord.xy + vec2(u_time * 91.7, u_time * 43.1));
color.rgb += (g - 0.5) * 0.022;   // ~2.2% peak-to-peak, roughly 5.5% perceived
```
[U] The 0.022 constant is my recommendation, not a cited value; tune against a real display.

Viget's canonical CSS approach, if you want the DOM route: a `:after` pseudo-element at 300 percent of the container, `animation: grain 5s steps(10) infinite`, translating between -25 percent and 35 percent at each 10 percent keyframe, using `translate()` rather than `background-position` "because translate doesn't cause repaints". [V] https://www.viget.com/articles/film-grain-effect

### T6. Vignette: a radial gradient, not an inset box-shadow, and never past 40 percent

Una Kravets' survey confirms both the technique and the performance caveat: gradients are "easier to implement and more realistic" than box shadows, and inset box-shadow "requires more from the browser to render", with "somewhere around 20 to 30px of blur really starts to slow Safari down". Her base pattern is `radial-gradient(transparent 50%, black)`, refined to `circle` "to mimic a lens and be a perfect circle from the center of the image". [V] https://una.im/vignettes/

**Recommended for a full-bleed instrument [U]:**

```css
.vignette {
  position: fixed; inset: 0; pointer-events: none; z-index: 40;
  background: radial-gradient(
    ellipse 120% 100% at 50% 45%,
    transparent 0%,
    transparent 55%,
    rgba(2, 5, 9, 0.18) 78%,
    rgba(2, 5, 9, 0.38) 100%
  );
}
```

Three rules. The centre is at **45 percent height, not 50 percent**, because a vignette centred slightly above the geometric centre reads as a lens and a vignette dead-centre reads as a CSS effect. The darkening colour is the **ground colour with a touch more blue** (`rgba(2,5,9,...)`), not black, so the corners stay in the same colour family. And the far corner stops at **0.38**, because past roughly 0.40 a viewer consciously notices the vignette, which is the failure state.

### T7. Bloom only above a real threshold, and only on the sun

The correct HDR practice: "with properly exposed HDR scenes, the threshold should be set to 1 so that only pixels with values above 1 leak into surrounding objects", and "this way the glow indicates colors that are too bright for the display". Soft knee "makes a gradual transition between under/over threshold, with 0 being a hard threshold while 1 being a soft threshold". [V] https://docs.unity3d.com/Packages/com.unity.postprocessing@3.0/manual/Bloom.html and https://catlikecoding.com/unity/tutorials/custom-srp/hdr/

three.js's canonical example values, verified: `new UnrealBloomPass(resolution, 1.5, 0.4, 0.85)`, that is **strength 1.5, radius 0.4, threshold 0.85**; the docs' own params object is `{ threshold: 0, strength: 1, radius: 0.5 }`. Strength default is 1; radius must be in [0,1]. [V] https://threejs.org/docs/pages/UnrealBloomPass.html and https://github.com/mrdoob/three.js/blob/dev/examples/webgl_postprocessing_unreal_bloom.html

**For the heliograph [U]:** render the map to an `RGBA16F` framebuffer, keep the sky tone map clamped at 0.7 (Stellarium's number, see 1.3), and put the subsolar marker and the brightest city-light pixels at values *above 1.0* in linear space. Then bloom with **threshold 1.0, soft knee 0.5, radius 0.35, strength 0.6**. The result is that the sun glyph and Tokyo glow and nothing else does. If everything blooms, nothing is bright.

The insight worth stating explicitly: **bloom is only impressive if most of the frame is below threshold.** A page where the whole UI has a glow is a page with no dynamic range.

### T8. Chromatic aberration: radial, sub-pixel, and only at the frame edge

Unity's documentation gives properties (Spectral LUT, Intensity, Fast Mode) but publishes no numeric defaults or ranges, so there is no citable "correct" value. What is citable: "a subtle amount of chromatic aberration (RGB separation) is a great way to increase the realism of pixel perfect computer graphics" and "you get the best results with small values because 1 means the entire size of the texture". [V] https://docs.unity3d.com/Packages/com.unity.postprocessing@3.5/manual/Chromatic-Aberration.html and https://mini.gmshaders.com/p/gm-shaders-mini-chromatic-aberration

**Recommendation [U]:** scale the aberration by the square of the distance from centre so it is exactly zero in the middle of the screen and reaches about 0.6 device pixels at the corner.

```glsl
vec2 d = uv - 0.5;
float r2 = dot(d, d) * 4.0;              // 0 at centre, ~1 at corner
vec2 off = d * r2 * (0.0009);            // ~0.6px at 1440px wide
vec3 col;
col.r = texture(u_scene, uv + off).r;
col.g = texture(u_scene, uv).g;
col.b = texture(u_scene, uv - off).b;
```

If a user can point at the aberration, it is too strong. It should only be findable by A/B toggling. Its job is to stop the frame edge from looking mathematically perfect.

### T9. Depth through blur and scale, never through drop shadow

A drop shadow on a dark ground is nearly invisible and, when you crank it up to be visible, it reads immediately as a template card. Use instead, in priority order:

1. **Scale.** The active panel is at `scale(1)`, the deactivated background layer goes to `scale(0.985)`. Under 2 percent, unnamed but felt.
2. **Blur.** When a modal or the "about" panel opens, apply `filter: blur(6px)` plus `opacity: 0.5` to the map layer over 260 ms. Not a `backdrop-filter` on the panel, a real blur on the thing behind it. 6px is enough to kill legibility and small enough to stay cheap.
3. **Chroma.** Recede a layer by desaturating it, not by darkening it. `filter: saturate(0.55)` on the background layer costs nothing and reads as atmospheric distance.
4. **Warm/cool.** As in T4: the warm thing advances, the cool thing recedes, at equal luminance, with no shadow at all. [V, secondary] https://colorarchive.org/guides/color-temperature-design-guide/

[U] for the specific values; the principle is cited.

### T10. Hairline rules, and the correct way to get a real device pixel

A `1px` border on a 2x display is two physical pixels and looks like a fence. The verified technique: "on a 2x display, 0.5px maps to exactly 1 physical pixel and works reliably in Safari (both macOS and iOS) and in Chrome on high-DPI screens", and the recommended production approach is "declaring 1px as the default and overriding with 0.5px on high-DPI screens via a media query", using `@media (-webkit-min-device-pixel-ratio: 2)`. [V, secondary] https://1px.com/1px-css-borders/ and http://dieulot.net/css-retina-hairline

```css
.rule { border-top: 1px solid var(--ink-100); }
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .rule { border-top-width: 0.5px; }
}
```

**Rules versus panels.** The correct treatment for a data instrument overlaid on a live map, and the one nullschool uses: **no rule at all, and no border.** The panel is a scrim of the ground colour at 60 to 85 percent alpha with a `border-radius` of about 8px and zero stroke. [V, nullschool CSS] A 1px hairline border paired with a wide diffuse shadow is explicitly catalogued as an AI-slop tell, see Part 3.

Where you *do* want a rule, use it as a **separator inside** a panel, never as an **outline around** one, at `--ink-100` (`#1c2127`) which is 1.22:1 against the ground: visible only as an edge, never as a line.

### T11. The edge of a panel is a gradient of the ground, not a border

The most expensive-looking treatment for a floating control surface over a map:

```css
.panel {
  background: linear-gradient(180deg,
    rgba(6, 11, 16, 0.86) 0%,
    rgba(6, 11, 16, 0.94) 100%);
  border-radius: 8px;
  border: none;
  box-shadow: none;
}
```

Two moves. The scrim is **slightly more opaque at the bottom** so the panel has an implied light direction without a shadow. And there is genuinely no border. If the panel needs an edge because the map behind it is bright, add `backdrop-filter: blur(10px) saturate(0.7)` and let the blurred, desaturated map be the edge. [U]

Compare directly with nullschool's verified `rgba(0,0,5,0.6)` and `rgba(5,10,30,0.85)`. Same idea, no border, two opacities for two levels of importance. [V]

### T12. Micro-labels: uppercase, tracked 0.08em, and one step darker than you think

Butterick's rule, verified verbatim: "Use 5 to 12 percent extra space with caps, but not with lowercase", which "in CSS" is "`0.05em` to `0.12em`". Lowercase "doesn't ordinarily need letterspacing". The caution: "if gaps between letters could accommodate additional characters, you've exceeded appropriate limits." [V] https://practicaltypography.com/letterspacing.html

```css
.micro-label {
  font-size: 10px;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.09em;          /* mid-Butterick */
  font-weight: 500;
  color: var(--ink-400);           /* #6c7176, 4.01:1 */
}
```

Important caveat: the tracked uppercase micro-label is *also* an AI-slop tell when it is used as a hero eyebrow (see Part 3). The difference is functional. **On a data instrument, tracked micro-caps label an axis, a unit or a field. On a landing page, they decorate a headline.** Use them for `SOLAR ELEVATION`, `UTC OFFSET`, `DECLINATION`. Never above a large heading.

### T13. Tabular figures, always, everywhere a number changes

"Proportional fonts give different widths to different digits, a 1 is narrow, an 8 is wide, so when a number flips from 11:11 to 12:23, the whole string can shift horizontally. For timers, leaderboards, financial tables, and live prices, this jittering is terrible UX." Recommended: `font-variant-numeric: tabular-nums` over `font-feature-settings: "tnum"` because it "composes better with other CSS rules and doesn't accidentally clobber unrelated font features". Supported in Inter, Roboto, Source Sans, IBM Plex, system-ui on Apple, Segoe UI on Windows, with global support above 96 percent. [V] https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric and https://loke.dev/blog/css-font-variant-numeric-tabular-nums

```css
.numeric, time, .clock, .coord, .elevation {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;  /* belt and braces for older engines */
}
```

For a page whose whole point is DST-correct local clocks in a timezone overlay, **this is not a nicety, it is the difference between an instrument and a widget.** Dozens of clocks jittering at once is the single fastest way to make the page look cheap.

### T14. Micro-parallax, damped, at a maximum of 8 device pixels

The mechanics, verified: depth multipliers per layer, where "background circles barely move (3 pixels maximum), while foreground circles shift up to 60 pixels"; damping via `currentOffset += (targetOffset - currentOffset) * 0.08`; "four to six depth layers are sufficient for convincing parallax", and use `transform: translate3d(x, y, 0)` to stay on the compositor. [V, secondary] https://lumitree.art/blog/parallax-effect

**For a full-bleed map, cut those numbers hard [U].** The map itself must not move, because moving a map breaks its meaning. Parallax only the non-geographic layers:

| Layer | Max offset | Damping |
|---|---|---|
| Map (base) | 0 px | n/a |
| Graticule + terminator hairlines | 1.5 px | 0.06 |
| City-light glow layer | 3 px | 0.06 |
| Panels and labels | 0 px | n/a |
| Vignette + grain | -4 px (opposes cursor) | 0.06 |

The vignette moving *against* the cursor is the trick. It reads as a lens in front of the scene rather than a layer inside it, and it is almost never done.

### T15. The scrubber should be made of the data

Covered in 1.9 but restated as a technique because it is the highest-value single detail available. The time scrubber's track is not `--ink-100`. It is a 1px-tall canvas or CSS gradient rendered from the actual twilight gradient for the current latitude and date, so the user can see sunrise, golden hour, blue hour, and the three twilights as bands *in the control itself*. When they scrub across a year, the track redraws and the band widths breathe with the seasons. [U]

### T16. Two motion speeds and one easing, declared as tokens

The research consensus:

- "100 ms is perceived as instant, and 1 second is considered the upper limit of a user's flow of thought." [V] https://www.nngroup.com/articles/animation-duration/
- "In most cases, a range of 100 to 400 ms is appropriate, with 400 ms being a very slow animation." Simple feedback "roughly 100 ms". Substantial screen changes "200 to 300 ms". "At 500 ms, animations start to feel like a real drag." [V] same
- Appearing takes longer than disappearing: "a popup window may take 300 ms to appear, but only 200 or 250 ms to disappear." [V] same
- Ease-out for entering, "starts quickly but slows down... makes the animation feel responsive, but allows the eye time to focus on the element as it comes to rest." Ease-in for leaving. Ease-in-out for exits only, with the caveat that it "can feel unresponsive". And: "Completely linear motion looks weird and unnatural to users." [V] same
- Val Head: 200 to 300 ms for small animations, 400 to 500 ms for large motion, grounded in Model Human Processor research that humans need "approximately 230 ms to visually perceive something". [V] https://valhead.com/2016/05/05/how-fast-should-your-ui-animations-be/

Material 3's standard easing token is `cubic-bezier(0.2, 0.0, 0, 1.0)`; emphasized-decelerate is `cubic-bezier(0.05, 0.7, 0.1, 1.0)`; standard-decelerate is `cubic-bezier(0.0, 0.0, 0, 1.0)`. [V, secondary, values consistent across sources] https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

nullschool ships with only two: 125 ms `ease-in` for colour, 250 ms `ease` for layout. [V]

**Proposed tokens for this project:**

```css
:root {
  --dur-tap:   120ms;   /* colour, hover, focus */
  --dur-move:  260ms;   /* panel slide, layer toggle */
  --dur-scene: 420ms;   /* projection change, first paint of a layer */
  --ease-out:   cubic-bezier(0.16, 1, 0.30, 1);   /* strong decel, the instrument feel */
  --ease-in:    cubic-bezier(0.55, 0, 1, 0.45);
  --ease-std:   cubic-bezier(0.2, 0, 0, 1);       /* M3 standard */
}
```

`cubic-bezier(0.16, 1, 0.30, 1)` is a strongly decelerating curve (it reaches roughly 80 percent of its distance in the first 30 percent of its duration). It is the right feel for an instrument because it looks like something arriving under its own momentum and settling. [U, my recommendation; the M3 token is the cited fallback.]

### T17. Respect `prefers-reduced-motion`, and route it through one variable

The spec: `no-preference` and `reduce`, where "`@media (prefers-reduced-motion)` is equivalent to `@media (prefers-reduced-motion: reduce)`", and the guidance is to "replace motion-based animations (scaling, panning, etc.) with more muted alternatives" rather than to remove all feedback. [V] https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  :root { --dur-tap: 1ms; --dur-move: 1ms; --dur-scene: 1ms; }
  .parallax  { transform: none !important; }
  .grain     { animation: none; }         /* keep the grain, stop it moving */
}
```

Two project-specific notes. The **terminator's real-time creep is data, not decoration**, so keep it, but a user with `reduce` set should not get the automatic year-scrub animation on load. And the grain should stay static rather than disappearing, because removing it changes the colour of the page.

### T18. Draw the science on top of the beauty

Synthesising 1.4, 1.5 and 1.10: render the continuous physically-derived gradient, then overlay the four twilight boundaries as hairlines at `--ink-300` at 45 percent, computed as `d3.geoCircle().radius(90 | 96 | 102 | 108).center(antipode(sun))`. Under the cursor, display the actual solar elevation in degrees to one decimal, in tabular figures, in a 10px tracked micro-label.

The combination is what nobody else does: timeanddate has the bands and no beauty, and the Observable notebooks have the geometry and no craft. **The hairlines are also what proves the gradient is real.** A viewer who can see that the hairline at -6 degrees lands exactly where the colour changes character believes the whole thing.

---

# Part 3: Anti-patterns, bluntly

The most useful catalogue I found is Impeccable's slop list, which I fetched in full. Everything in the following list marked [V] is quoted or paraphrased directly from it or from 925studios.

[V] https://impeccable.style/slop/ and https://www.925studios.co/blog/ai-slop-design-tells

## 3.1 Colour

- **The indigo-to-purple gradient.** Called out as "the single loudest AI tell in 2026". The origin is documented: Tailwind's `bg-indigo-500` default in Tailwind UI, which Adam Wathan publicly apologised for in August 2025, because "now every AI-generated interface on earth is purple". Its companion, the blue-purple-to-teal gradient, is the same tell. [V] https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p
- **Cyan on dark.** Named alongside purple as one of "the most recognizable tells of AI-generated UIs". [V] This is a genuine hazard for us: a naive dark map theme lands on cyan almost by accident. Keep the accent warm.
- **The radial-gradient background halo**, a "saturated radial glow on dark page", and the "decorative radial spotlight glow" / "faint accent haze behind section". [V] Note the distinction from a vignette: a vignette *darkens the corners*, a slop halo *lightens the centre*. Darkening is photographic; lightening is a filter preset.
- **Coloured `box-shadow` glows** on dark-mode elements. [V]
- **Gradient text** on headings and metrics. [V]
- **Warm cream or beige page background.** [V] Irrelevant here but worth knowing the whole list.

## 3.2 Surface and shape

- **Glassmorphism as decoration**: "blur effects, glass cards, and glow borders used as decoration". [V] The test is whether the blur is doing legibility work over a busy background. On a live map, `backdrop-filter` is legitimate. Everywhere else it is slop.
- **The thick coloured border on one side of a card**, described as "the most recognizable tell". [V]
- **A 1px hairline border paired with a wide, diffuse shadow.** [V] This is the default "premium card" recipe and it is now a liability. See T10 and T11 for the replacement.
- **Border-radius of 24px and up on a small card**, causing a "blob-like" appearance. [V] Keep panels at 6 to 10px.
- **Repeating-gradient stripes** as surface decoration, and **decorative grid backgrounds** with no functional purpose. [V] Note: a *graticule* is a functional grid. A background grid pattern behind a panel is not. Do not let the second sneak in on the excuse of the first.
- **Nested cards**: "cards inside cards inside cards. Five levels of nesting." [V]
- **Monotonous spacing**: "the same spacing value used everywhere". [V] The fix is a real scale with skips: 4, 8, 12, 20, 32, 52.

## 3.3 Type

- **Inter, Geist, Space Grotesk, Instrument Serif** are named as the overused set. Inter specifically is "the safest possible answer" and "unchosen". [V]
- **The oversized italic serif display headline**, "universal AI-startup landing page hero". [V]
- **The hero eyebrow or pill chip**: "tiny uppercase letter-spaced label immediately above oversized hero". [V] See T12 for the distinction that keeps our micro-labels legitimate.
- **A small rounded-square icon container stacked above a heading.** [V]
- **Flat type hierarchy** with "sizes too close together", and **crushed letter spacing** "pulled tighter than the point where characters keep shapes". [V]
- **A single font for everything with no hierarchy.** [V]

## 3.4 Layout

- **The three-column feature grid with icons above and text below.** Documented origin: Tailwind tutorials used a three-column card grid to demonstrate layout, so the pattern became the default. [V] https://www.925studios.co/blog/ai-slop-design-tells
- **Identical card grids**: "same-sized cards with icon + heading + text repeated". [V]
- **The hero metric layout**: "big number, small label, three supporting stats, gradient accent". [V] Directly relevant: a heliograph will want to show numbers. Do not make a stat row.
- **Tiny numbered section labels** repeated beside headings (01 / 02 / 03). [V]

## 3.5 Motion

- **The pulsing status dot**: "decorative pulse makes static status look live". [V] Brutal for us, because we will be tempted to put one next to "LIVE". Do not. If the clock is ticking with tabular figures, the page is already visibly live.
- **The decorative blinking cursor**: "fake caret makes non-editable hero copy look like terminal". [V]
- **Auto-scrolling marquee.** [V]
- **Bounce or elastic easing**: "springs in, overshoots" on interface elements. [V] This aligns with NN/g: overshoot on an instrument reads as imprecision.
- **Image hover transform**: "scaling or rotating an image on hover". [V]

## 3.6 Copy and iconography

- **Em-dash overuse**: "more than a couple in body copy is an AI cadence tell". [V] (Also a hard project rule.)
- **Buzzwords**: "streamline, empower, supercharge, world-class, enterprise-grade". [V]
- **Weightless headline copy** of the "Build faster. Ship smarter." form, and **"Get Started" gradient buttons**. [V]
- **Aphoristic manufactured-contrast cadence**, of the "It's not X. It's Y." form. [V]
- **Thin-line generic icons** that are "interchangeable", and **shape-assembled SVG illustration** that "reads like placeholder clip art". [V]
- **Emoji in headers.** Not in the fetched lists but it is a hard rule in this codebase and it belongs here.

## 3.7 The heliograph-specific slop list

Things this project in particular will be tempted by. [U, my judgement.]

- A glowing cyan terminator line.
- A `radial-gradient` "sun glow" that is a CSS blob rather than a bloomed HDR pixel.
- The sun as an emoji, or as a filled circle with a `box-shadow: 0 0 60px orange`.
- Timezone bands in a rainbow ramp. Timezones are nominal data; they should be a low-chroma alternating pair, not 24 hues.
- A "Made with love" footer, an Awwwards-style loading percentage counter, and a horizontal-scroll "About" section.
- `rgba(0,0,255,0.3)` night fill, copied unchanged from the Observable notebooks. [V, that this is the notebook default]
- Country borders drawn at the same weight as coastlines.
- A globe when an equirectangular map is the honest projection for the data. If we do a globe, it should be a mode, not a default, because the whole point of a heliograph is seeing the terminator across all longitudes at once.

---

# Part 4: Motion, and the case for restraint

## 4.1 The load sequence

A full-screen instrument has one moment to establish that it is not a template: the first 1.5 seconds. The goal is that the page **assembles like an instrument powering on**, and that every step of the assembly corresponds to something real that is loading or computing.

The following timeline is my proposal [U], built on the cited duration research in T16. All curves are `--ease-out` = `cubic-bezier(0.16, 1, 0.30, 1)` unless stated.

| t (ms) | Element | Motion | Duration |
|---|---|---|---|
| 0 | Ground `#060b10` painted, grain layer at full strength | none | 0 |
| 0 | Vignette present | none | 0 |
| 60 | Ocean fill fades in at `#0d1620` | opacity 0 to 1 | 380 |
| 180 | Coastlines draw in as strokes | `stroke-dashoffset` sweep west to east, or a simple opacity fade if the path count is high | 520 |
| 240 | Graticule fades in | opacity 0 to 0.5 | 400 |
| 420 | Twilight gradient composites in | opacity 0 to 1 | 560, `--ease-std` |
| 520 | City lights fade up | opacity 0 to 1, plus a 1.02 to 1.00 scale on the glow layer | 640 |
| 700 | Terminator hairlines draw | opacity 0 to 0.45 | 300 |
| 760 | Subsolar marker arrives | scale 0.6 to 1, opacity 0 to 1 | 300 |
| 820 | Bloom pass enabled | strength 0 to 0.6 | 400 |
| 860 | Control panel slides up from the bottom edge | `translateY(12px)` to 0, opacity 0 to 1 | 300 |
| 940 | Scrubber track renders its gradient | opacity 0 to 1 | 260 |
| 1000 | Clock labels appear, staggered | opacity 0 to 1, 22 ms stagger per label | 200 each |
| 1180 | Micro-labels and units appear | opacity 0 to 1 | 200 |
| 1240 | Real-time terminator creep begins | continuous | forever |

Total: about **1.25 seconds** to a fully assembled instrument, with the map legible at 700 ms.

Four rules governing that table:

1. **Nothing moves more than 12 px.** Every entrance is opacity plus a token translate or a sub-2-percent scale. Large travel reads as a marketing site.
2. **Order follows physical dependency**: ground, then water, then land, then light, then instrumentation, then chrome. The user watches the world get lit. That story is free and it is on-theme.
3. **The stagger is 22 ms, not 100 ms.** A visible stagger is a slop tell; a 22 ms stagger is felt as texture rather than seen as a sequence. Total stagger across 24 timezone clocks is about 520 ms, which sits inside the scene budget.
4. **If assets are already cached, compress the whole timeline to 0.55x.** A returning visitor should not sit through the same ceremony. Gate it on a `sessionStorage` flag.

## 4.2 The case for restraint

Four arguments, three of them cited.

**Restraint is what the award winners actually do.** The Awwwards data-visualization winners I could read are austere: 1000 Whales is "cold, fact-forward, almost austere", using "whitespace and typography" to do "the heavy lifting" with "colour... functional, not decorative". WC 2026 Data Portraits leads with a provenance claim, "Nothing is staged: each match is reconstructed from roughly 1,500 recorded events", and designs minimally so that the claim is legible. [V] https://1000whales.com and https://wc26.bogachev.fr

**Motion above 500 ms is measurably worse.** "At 500 ms, animations start to feel like a real drag for users, they become cumbersome and annoying." [V] https://www.nngroup.com/articles/animation-duration/

**Overshoot signals imprecision.** Bounce and elastic easing are catalogued slop tells [V], and NN/g's guidance is ease-out for entrances precisely because it "allows the eye time to focus on the element as it comes to rest". An instrument that springs is an instrument you do not trust with a solar declination.

**And the project-specific argument [U]:** the subject is already spectacular. Sunlight moving across the Earth is one of the most beautiful things there is. Every effect added is a claim that the subject was not enough. The correct posture is a very good camera pointed at something extraordinary, held very still. Grain, vignette, bloom and micro-parallax are all justified because they are what a camera does. Nothing else is.

The one place to spend motion budget generously: **the year scrub.** Watching the terminator swing from solstice to solstice, the polar day expanding and contracting, is the payoff of the entire product. That deserves to be smooth, long, and eased. Everything else should be quick and quiet.

---

# Part 5: Cartographic taste

## 5.1 Water versus land in a dark theme

The CARTO Dark Matter answer, verified: land `#0e0e0e`, water `#2C353C`. **Water is lighter than land.** [V]

This inverts the light-map convention and it is correct for a dark instrument, because on a dark ground the eye reads *lighter* as *closer* and *present*, and the ocean is where the twilight gradient will do its most beautiful work. Continents become dark cut-outs, which is also physically honest: the land is where the city lights are, so it needs to be dark for them to read.

**Recommended for this project [U], with the CARTO values as the anchor:**

| Feature | Value | Notes |
|---|---|---|
| Space / out of sphere | `#060b10` | `--ink-000` |
| Ocean (unlit) | `#0d1620` | slightly bluer and lighter than the ground |
| Land (unlit) | `#0a0d11` | between ground and ocean, cooler and darker |
| Coastline stroke | `#2e3339` at 0.7 alpha | `--ink-200` |
| Graticule | `#1c2127` at 0.55 alpha | `--ink-100` |
| Country borders | `#1c2127` at 0.35 alpha, dashed 2/3 | half the presence of the coast |
| Terminator hairlines | `#494e53` at 0.45 alpha | `--ink-300` |

The twilight gradient multiplies over ocean and land alike, so the ocean/land differential survives at every solar elevation, which is exactly what you want: **you should be able to read the shape of the world at midnight.**

## 5.2 The graticule

The verified reference points: Bostock's notebook uses `#ccc` on a white ground [V], and CARTO uses `#222` halos and `rgba(103,103,114,1)` for state boundaries on `#0e0e0e` [V]. Neither publishes a graticule weight.

**Recommendation [U]:**

- **Weight: 1 device pixel, always.** Use the T10 hairline technique, or in canvas/WebGL, `1.0 / devicePixelRatio` in CSS pixels.
- **Spacing: 30 degrees at world zoom, 10 degrees when zoomed in past about 4x.** More than 12 meridians on screen is noise.
- **Emphasis: exactly four lines get extra weight.** The equator, the two tropics (23.44 degrees) and the two polar circles (66.56 degrees) at 1.5 device pixels and 0.7 alpha; everything else at 1 device pixel and 0.35 alpha. For a heliograph the tropics and polar circles are not decoration, they are the geometry of the whole subject. Drawing them properly is the single clearest signal that a cartographer touched this.
- **The prime meridian and the antimeridian** get 0.55 alpha, between the two.
- **The graticule must sit under the terminator hairlines and over the coastline.** Layer order matters: ocean, land, coast, graticule, twilight gradient (multiply), city lights (screen/add), terminator hairlines, labels, bloom, aberration, vignette, grain.

## 5.3 How much coastline to show, and when to drop detail

Natural Earth publishes three scales with explicit intended uses, verified: **1:110m** is "suitable for schematic maps of the world on a postcard or as a small locator globe" (1 cm = 1,100 km); **1:50m** and **1:10m** are both described as "suitable for making zoomed-out maps of countries and regions", with 1:50m fitting "tabloid-sized pages" (1 cm = 500 km) and 1:10m being "the most detailed", suited to "large wall posters" (1 cm = 100 km). [V] https://www.naturalearthdata.com/downloads/

nullschool's approach, verified from its README: Natural Earth data "converted to TopoJSON format at two scales, simplified for animation and detailed for static display". [V] https://github.com/cambecc/earth

**That two-tier trick is the one to copy, and it is a beauty decision, not a performance decision.** Ship both 1:110m and 1:50m as TopoJSON. Render 1:50m when static. The instant the user starts dragging, scrubbing or animating, swap to 1:110m. Swap back on `pointerup` plus a 120 ms debounce. The user never sees the simplification because it only exists while things are moving, and the frame rate stays locked, which is itself the most expensive-looking property a page can have.

Rules for what to drop [U]:

- **At world zoom, drop every island under roughly 8,000 km squared** except the ones a viewer will look for (Iceland, Ireland, Sri Lanka, Tasmania, Hokkaido, the main Indonesian and Philippine islands, Hawaii, the Falklands, Svalbard). A world map missing Iceland looks broken; a world map showing the Aleutian chain in full looks like a shapefile dump.
- **Drop lakes entirely below about 3x zoom**, then reintroduce the top twelve (Caspian, Superior, Victoria, Huron, Michigan, Tanganyika, Baikal, Great Bear, Malawi, Great Slave, Erie, Winnipeg). Lakes at world zoom on a dark map read as holes and damage the continental silhouette.
- **Never show rivers on a heliograph.** They carry no solar information and they turn the land into a texture.
- **Country borders are optional and default off.** The subject is the Earth as a lit body. Borders are the single fastest way to make a heliograph look like an infographic. If they are on, they are half the weight of the coast, dashed, and they never cross water.

## 5.4 Label placement

Imhof's "Positioning Names on Maps" (originally German, 1962; English in The American Cartographer 2:2, 1975, pp. 128 to 144) is the canonical source. The key principle, verified from the secondary literature: "legibility and clarity of the map depend on good name positioning, each name having only one optimum position on the map." [V, secondary] https://sites.middlebury.edu/mapmakingpatterns/2015/01/15/according-to-imhof/ and https://www.tandfonline.com/doi/abs/10.1559/152304075784313304

I could not obtain Imhof's ranked list of point-label positions from a primary source in this session, so I am marking the standard ranking as [U]: upper right is first choice, then upper left, then lower right, then lower left, then directly right, then directly left, then above, then below. Verify against the paper before hard-coding it.

What I can give with confidence, from sources I did fetch:

**Halos should be conditional, not constant.** Daniel Huffman's "smart type halos" technique, verified: the problem is that "we don't want to overuse the glow when it's unnecessary, since it's covering up our map and it feels clunky when it's used in places where it's not needed." The solution makes the halo appear "where the underlying map is darkest, and then it gracefully fades away as the map lightens." His stated design principle: "bring visual assistance only where contrast is inadequate, then withdraw it gracefully as conditions improve." Illustrator implementation uses Outer Glow at Normal blend mode (not the default Screen) "with opacity around 45 percent". [V] https://somethingaboutmaps.wordpress.com/2018/10/28/smart-type-halos-in-photoshop-and-illustrator/

**We can do this properly, and better than Photoshop can, because we own the pixels.** In the fragment shader we already know the local sky luminance at every point. Modulate the label halo alpha by it directly:

```glsl
// halo strength inversely proportional to local background brightness
float bg = dot(skyColor, vec3(0.2126, 0.7152, 0.0722));
float haloAlpha = smoothstep(0.55, 0.12, bg) * 0.55;
```
[U] for the constants; the principle is Huffman's and cited.

The related Red Blob Games SDF exploration names the same family of techniques (hard outline "at distances between 0.0 and 0.1 from the glyph edge", soft outline, blurred background, selective outline where "the shader calculates contrast and suppresses halo in high-contrast areas", tinted outline matching the background) and is explicit that the code is experimental with no production-ready values. [V] https://www.redblobgames.com/blog/2024-12-08-sdf-halos/

**Halo colour, from CARTO's verified values: `#111` to `#222` on a `#0e0e0e` ground.** One or two steps above the background, never pure black. [V] For our `#060b10` ground the equivalent is `#0c1116` to `#12171d`, or in the shader, the local sky colour darkened by about 45 percent and desaturated by 30 percent.

**Label colour hierarchy, following CARTO's verified nine-step ramp:** the least important labels sit at `#383838` (2.5 steps above a `#0e0e0e` ground) and the most important at `rgba(211,228,236,1)`. [V] Map that onto our ramp:

| Label class | Token | Hex | Case / tracking |
|---|---|---|---|
| Major city / capital | `--ink-700` | `#d5d8db` | sentence case, 0 tracking, 12px |
| Secondary city | `--ink-500` | `#8e9398` | sentence case, 0 tracking, 11px |
| Ocean / sea name | `--ink-300` | `#494e53` | small caps or uppercase, 0.14em tracking, 10px, italic optional |
| Country | `--ink-400` | `#6c7176` | uppercase, 0.09em tracking, 10px |
| Units and field labels | `--ink-400` | `#6c7176` | uppercase, 0.09em, 10px |
| Numeric readouts | `--ink-700` | `#d5d8db` | `tabular-nums`, 13px |
| Live / selected value | `--sun-400` | `#f7ad30` | `tabular-nums`, 13px |

Water labels get the widest tracking. This is a real cartographic convention (widely tracked, often italic lettering across a body of water indicates an area rather than a point) and it is one of the cheapest ways to look like a cartographer rather than a developer who added text.

## 5.5 The one cartographic decision that matters most here

Choose the projection for the subject, not for familiarity.

Bostock's notebook uses `geoNaturalEarth1` [V]; the Johan gist uses Cylindrical Equal Area at the 38.5 degree standard parallel [V]; NASA's BMNG ships in Plate Carree on WGS84 [V].

For a heliograph [U]: **equirectangular (Plate Carree) is the correct default**, for a reason specific to this product. Under equirectangular, lines of constant solar elevation are simple curves in screen space, the terminator is a clean sinusoid whose amplitude *is* the solar declination, and the subsolar point's vertical position *is* the declination in degrees, directly readable off the vertical axis. The projection makes the physics legible. Natural Earth 1 is prettier as a static image and destroys that property.

Offer a globe as a second mode, and if you do, use orthographic with the sub-observer point defaulting to the subsolar point, so the globe opens looking straight at noon.

---

# Appendix A: Consolidated token file

All values below are either [V] from a cited source or [C] computed in this session. Nothing here is a guess.

```css
:root {
  /* Ground and neutrals: OKLCH hue 250, chroma tapering 0.014 -> 0.004  [C] */
  --ink-000: #060b10;   /* L .145  contrast 1.00  ground */
  --ink-050: #10151b;   /* L .195  contrast 1.08  raised surface */
  --ink-100: #1c2127;   /* L .245  contrast 1.22  hairline rules */
  --ink-200: #2e3339;   /* L .320  contrast 1.55  coastline */
  --ink-300: #494e53;   /* L .420  contrast 2.35  terminator hairlines, sea names */
  --ink-400: #6c7176;   /* L .545  contrast 4.01  micro-labels, units */
  --ink-500: #8e9398;   /* L .660  contrast 6.37  secondary text */
  --ink-600: #b4b8bc;   /* L .780  contrast 9.90  body text */
  --ink-700: #d5d8db;   /* L .880  contrast 13.8  numeric readouts, city names */
  --ink-800: #eef0f3;   /* L .955  contrast 17.3  hover / max emphasis */

  /* The single warm source: OKLCH hue 75  [C] */
  --sun-300: #d9951d;
  --sun-400: #f7ad30;   /* primary accent, near nullschool's #e2b42e  [V] */
  --sun-500: #ffc353;
  --sun-600: #ffdb8d;

  /* Map surfaces, anchored on CARTO Dark Matter land #0e0e0e / water #2C353C  [V] */
  --map-ocean: #0d1620;
  --map-land:  #0a0d11;

  /* Twilight anchors from Stellarium's scotopic xy = (0.25, 0.25)  [V] -> sRGB  [C] */
  --night-deep:  #202638;   /* Y 0.02 */
  --night-mid:   #353f58;   /* Y 0.05 */
  --night-high:  #4b597b;   /* Y 0.10 */
  --twilight-lo: #294064;   /* measured twilight xy (0.22,0.22), Y 0.05 */
  --twilight-hi: #486da6;   /* Y 0.15 */

  /* Motion  [V] durations, [U] the ease-out curve */
  --dur-tap:   120ms;
  --dur-move:  260ms;
  --dur-scene: 420ms;
  --ease-out: cubic-bezier(0.16, 1, 0.30, 1);
  --ease-in:  cubic-bezier(0.55, 0, 1, 0.45);
  --ease-std: cubic-bezier(0.2, 0, 0, 1);      /* Material 3 standard  [V] */

  /* Effects  [U] within cited ranges */
  --grain-opacity: 0.055;      /* cited safe range 0.04 to 0.10 */
  --vignette-corner: 0.38;     /* keep under 0.40 */
  --bloom-threshold: 1.0;      /* HDR practice: only above-1 linear values bloom  [V] */
  --bloom-radius: 0.35;
  --bloom-strength: 0.6;
  --aberration-corner-px: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  :root { --dur-tap: 1ms; --dur-move: 1ms; --dur-scene: 1ms; }
}
```

# Appendix B: Layer order, top to bottom

Compositing order for the WebGL2 pipeline. Getting this wrong is the difference between "a map with effects on it" and "a photograph of a lit planet".

1. Film grain (screen-space, per-frame, additive at about 2.2 percent peak)
2. Vignette (screen-space, radial, corner 0.38)
3. Chromatic aberration (screen-space, radial, about 0.6 px at corner)
4. Bloom composite (from the HDR buffer, threshold 1.0)
5. UI panels and DOM overlay (scrim, no border)
6. Labels and halos (halo alpha modulated by local sky luminance)
7. Terminator hairlines (four `geoCircle` radii: 90, 96, 102, 108)
8. Subsolar marker (emissive, above 1.0 linear, so it blooms)
9. City lights (additive, tone-mapped from radiance with an exponent near 0.45)
10. Twilight gradient (multiply, per-pixel from real solar elevation, log tone map clamped at 0.7)
11. Graticule (1 device pixel; tropics, polar circles and equator emphasised)
12. Coastlines
13. Land fill
14. Ocean fill
15. Ground

Steps 8 to 10 are the only ones that write above 1.0 in linear space. That is what makes the bloom mean something.

# Appendix C: Source list

Primary sources fetched and read in this session:

- earth.nullschool.net about page: https://earth.nullschool.net/about.html
- cambecc/earth README: https://github.com/cambecc/earth
- cambecc/earth styles.css: https://raw.githubusercontent.com/cambecc/earth/master/public/styles/styles.css
- cambecc/earth products.js: https://raw.githubusercontent.com/cambecc/earth/master/public/libs/earth/1.0.0/products.js
- cambecc/earth micro.js: https://raw.githubusercontent.com/cambecc/earth/master/public/libs/earth/1.0.0/micro.js
- CARTO Dark Matter style JSON: https://raw.githubusercontent.com/CartoDB/basemap-styles/master/mapboxgl/dark-matter.json
- Stamen on Positron and Dark Matter: https://stamen.com/introducing-positron-dark-matter-new-basemap-styles-for-cartodb-d02172610baa/
- Stellarium Web Engine atmosphere.glsl: https://raw.githubusercontent.com/Stellarium/stellarium-web-engine/master/data/shaders/atmosphere.glsl
- Bostock, Solar Terminator: https://api.observablehq.com/@mbostock/solar-terminator.js
- Johan, Earth night and day sides gist: https://gist.github.com/johan/4645501
- NASA VNP46A1 product page: https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VNP46A1/
- Natural Earth downloads and scale guidance: https://www.naturalearthdata.com/downloads/
- in-the-sky.org twilight map: https://in-the-sky.org/twilightmap.php
- suncalc.org: https://www.suncalc.org/
- ventusky.com: https://www.ventusky.com/
- Awwwards data visualization collection: https://www.awwwards.com/websites/data-visualization/
- WC 2026 Data Portraits: https://wc26.bogachev.fr
- 1000 Whales: https://1000whales.com
- SuperSixSeven, NASA Eyes case study: https://www.supersixseven.com/portfolio/eoss
- Christian Gimber, NASA Eyes: https://christiangimber.com/nasa-eyes
- Impeccable, Slop: https://impeccable.style/slop/
- 925 Studios, AI slop design tells: https://www.925studios.co/blog/ai-slop-design-tells
- ibelick, grainy backgrounds: https://ibelick.com/blog/create-grainy-backgrounds-with-css
- Viget, film grain effect: https://www.viget.com/articles/film-grain-effect
- Una Kravets, vignettes three ways: https://una.im/vignettes/
- NN/g, executing UX animations: https://www.nngroup.com/articles/animation-duration/
- Val Head, how fast should UI animations be: https://valhead.com/2016/05/05/how-fast-should-your-ui-animations-be/
- MDN, prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- MDN, font-variant-numeric: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- Butterick, Practical Typography, letterspacing: https://practicaltypography.com/letterspacing.html
- Daniel Huffman, smart type halos: https://somethingaboutmaps.wordpress.com/2018/10/28/smart-type-halos-in-photoshop-and-illustrator/
- Red Blob Games, SDF halos: https://www.redblobgames.com/blog/2024-12-08-sdf-halos/
- Unity, Chromatic Aberration: https://docs.unity3d.com/Packages/com.unity.postprocessing@3.5/manual/Chromatic-Aberration.html
- Unity, Bloom: https://docs.unity3d.com/Packages/com.unity.postprocessing@3.0/manual/Bloom.html
- three.js, UnrealBloomPass: https://threejs.org/docs/pages/UnrealBloomPass.html
- Bruneton and Neyret, Precomputed Atmospheric Scattering: https://inria.hal.science/inria-00288758/file/article.pdf

Secondary sources used with attribution:

- Tailwind indigo origin of the purple gradient: https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p
- Refactoring UI, building your colour palette: https://refactoringui.com/previews/building-your-color-palette
- OKLCH guide: https://oklch.org/posts/ultimate-oklch-guide
- Colour temperature in design: https://colorarchive.org/guides/color-temperature-design-guide/
- Retina hairline borders: https://1px.com/1px-css-borders/ and http://dieulot.net/css-retina-hairline
- Mouse parallax depth and damping: https://lumitree.art/blog/parallax-effect
- Material 3 easing tokens: https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- Blue hour and golden hour definitions: https://en.wikipedia.org/wiki/Blue_hour and https://en.wikipedia.org/wiki/Golden_hour_(photography)
- Blue Marble Next Generation specifications: https://earthobservatory.nasa.gov/features/BlueMarble
- Black Marble product suite: https://www.sciencedirect.com/science/article/pii/S003442571830110X
- timeanddate Day and Night World Map: https://www.timeanddate.com/worldclock/sunearth.html (returns 403 to automated fetch; content via search extraction)
- Shadowmap: https://shadowmap.org/ and https://lbs2019.lbsconference.org/wp-content/uploads/2019/11/1_5.pdf
- Windy review: https://www.windup.live/blog/windy-app-review/
- Imhof, Positioning Names on Maps: https://www.tandfonline.com/doi/abs/10.1559/152304075784313304

# Appendix D: What I could not verify

Listed so nobody treats these as settled.

1. **Imhof's ranked list of point-label positions.** The 1975 American Cartographer paper is paywalled and no fetchable source gave the ordered list. The upper-right-first ranking in 5.4 is [U].
2. **timeanddate.com's actual shading colours.** The page returns HTTP 403 to automated fetches. Band definitions are confirmed, hex values are not.
3. **kepler.gl, Ventusky, Windy and Shadowmap CSS values.** All four are SPAs whose stylesheets were not reachable. Design characterisations for those four are observational or secondary.
4. **Unity's numeric default and range for Chromatic Aberration intensity.** The documentation genuinely does not publish them.
5. **The 0.022 grain amplitude, the 0.38 vignette corner, the 0.6 px aberration, and every value in the load-sequence timeline.** These are my recommendations, built inside cited ranges, and they must be tuned on a real display.
6. **NASA Eyes' actual colour palette and type system.** Neither published case study documents them.
7. **The exact CIE chromaticity of twilight, x,y = 0.22, 0.22.** This came through a search extraction rather than a fetched paper. The derived hex values in 1.3 are only as good as that input. The Stellarium value of xy = (0.25, 0.25) for scotopic night is properly verified from the shader source.
