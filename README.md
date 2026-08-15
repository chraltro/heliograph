# Heliograph

A world map of sunlight. Where the sun falls on Earth, at any date and time, in
UTC or in local time.

![The map at 15:34 in Oslo on 14 August 2026](docs/images/heliograph.png)

## What you are looking at

Every pixel is coloured by the solar elevation angle at that exact latitude and
longitude. Nothing is a tinted photograph and nothing is a hand-picked gradient:
the colour of a place is what that place looks like from directly overhead with
the sun where it actually is.

The three surface ramps (ocean, land, permanent ice) come from a spectral model
built on published constants, the ASTM G-173 solar spectrum, IUP Bremen ozone
cross sections, Rayleigh and Mie parameters from Bruneton and Neyret, and the
Kasten and Young air mass, cross checked against measured imagery: Apollo 17
AS17-148-22727 for the ocean, NASA Blue Marble for the land, and Patat et al.
2006 twilight photometry for the colour of the sky below the horizon. That is
why the golden hour is gold, why snow goes pink at sunset while water goes
straight to blue, and why every surface converges on the same grey-blue within a
couple of degrees of the terminator: down there the atmosphere is most of what
you can see.

The land is real. Under the illumination sits the actual albedo of the actual
planet, resampled from Natural Earth's cross-blended hypsometric relief raster
at build time, which is why the Sahara is sand, the Amazon is dark forest, the
Tibetan plateau is high and pale, and the Greenland and Antarctic ice read as
ice: bright, colourless pixels in the data are shaded on the ice ramp, so real
snowfields go pink at sunset like snow and not like rock. On top of that the
map knows the season, from nothing but the solar declination it already tracks:
a ragged snow line follows the Sun into the mid latitudes of the winter
hemisphere and retreats in summer, and mid latitude vegetation browns as its
winter approaches. Scrub the year and watch Siberia whiten in January.

Over that continuous gradient sit four hairlines, at solar elevations of
-0.833, -6, -12 and -18 degrees: sunrise and sunset, then the ends of civil,
nautical and astronomical twilight. Most maps of this kind pick one or the
other. Discrete bands are legible and look like a diagram; a smooth gradient
looks like a photograph and cannot be read. Drawing both means the hairline at
-6 lands exactly where the colour changes character, which is what shows the
gradient is real.

The rest is instrumentation. The equator, the tropics and the polar circles are
drawn heavier than the other graticule lines because they are the geometry of
the whole subject: the subsolar point runs between the tropics and nowhere else,
and the polar circles are exactly where the sun stops rising and setting.

## Using it

**Set an instant.** Type a date and a time into the rail, drag either scrubber,
or press the arrow keys. The clock selector decides whether that time means UTC
or the wall clock in a particular zone.

**The scrubbers are made of the data.** The upper track is the sky colour at the
pinned place across twenty four hours, so sunrise, the golden hour and the three
twilights are visible as bands inside the control. The lower track is the same
reading across the year, so scrubbing one redraws the other and the bands
breathe with the seasons. The bright ticks are sunrise and sunset on the upper
track, and the solstices and equinoxes on the lower one.

**Animate.** `Live` follows the clock. `Day` sweeps twenty four hours in about
twenty seconds. `Year` runs a full year in about a minute while holding the wall
clock, so the terminator barely moves sideways and instead tilts, and the polar
day and polar night open and close. Space bar plays and pauses.

**Find a place.** Move the pointer over the map for a live readout, or click to
pin one. Scroll to zoom, drag to pan, `0` to reset.

**On a phone.** The map is the whole screen. The rail floats over its top edge
and the console folds into a bottom sheet that peeks the clock and the day
scrubber; pull it up, or tap it, for the rest of the readout, the year scrubber
and the animation controls. The page itself never scrolls or zooms, only the
map does: a phone opens zoomed in on wherever your browser thinks you are,
worked out from your time zone and without asking for location permission. Drag
to pan, pinch to zoom, double tap to zoom in, single tap to pin a place, and
the round button above the sheet brings the view home. There is no hover on a
touch screen, so the readout follows the pin rather than your finger, and every
control is sized for one. Added to a home screen it runs standalone, edge to
edge.

**Time zones.** Turn on the time zone layer to see the real, irregular zone
boundaries with each zone's own clock. Turn on `Same clock time` as well and
every zone currently reading the same wall clock as your chosen one lights up.
That is the quickest way to answer "where in the world is it 13:34 right now".

Everything is in the address bar, so any view can be linked to:

```
?t=2026-12-01T13:34Z&tz=Europe/Oslo&z=2&lon=10.7&lat=59.9&play=off
```

### Keyboard

| Key | Action |
|---|---|
| Space | Play or pause |
| Left, Right | Step an hour, or a day with Shift |
| `+`, `-` | Zoom |
| `0` | Reset the view |
| `L` | Layers |

<img src="docs/images/heliograph-phone.png" alt="The same map on a phone" width="300">

## Accuracy

Solar position follows the NOAA Solar Calculator, which is a condensation of
Meeus chapter 25. Measured against full VSOP87 it holds the declination to 13
arcseconds and the equation of time to 3.4 seconds, and against the US Naval
Observatory the subsolar point is good to 11 arcseconds of latitude and 46
arcseconds of longitude. On a 4096 pixel wide map that is a seventh of a pixel.
UTC is fed in directly with no delta T correction, which costs about one further
arcsecond.

Two places need more care than the obvious implementation gives, and both are
handled:

- **Sunrise and sunset** are found by scanning the solar day every ten minutes
  and bisecting each crossing, not by the fixed point iteration NOAA's own page
  uses. That iteration is not a contraction above roughly 63 degrees of
  latitude: at 70 north it can be twelve minutes out, and running it a third
  time makes it worse rather than better. Reykjavik and Tromso are exactly the
  places anyone looks at first on a map like this.
- **Solstices and equinoxes** use Meeus chapter 27 rather than root finding on
  the low accuracy solar longitude, which is wrong by up to eleven minutes near
  an equinox.

Sunrise and sunset are shown to the minute and not to the second, because above
about 60 degrees of latitude the limiting factor is not the ephemeris, it is the
assumption that refraction lifts the horizon by a standard 34 arcminutes.

Time zone offsets come from the runtime's own IANA database through `Intl`, so
daylight saving is always current and no zone table ships with the app. Wall
clock to UTC conversion follows the Temporal proposal's "compatible" rule: a
time skipped by a spring forward resolves to the first real instant after the
gap, and a time that happens twice in an autumn fall back resolves to the
earlier of the two.

## Running it

```
npm install
npm run dev
```

Then `npm run verify` for the whole check: typecheck, unit tests, production
build, and the browser tests.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build into `dist/` |
| `SINGLEFILE=1 npm run build` | One self-contained HTML file |
| `npm test` | Unit tests |
| `npm run e2e` | Browser tests |
| `npm run data` | Rebuild the map data from Natural Earth |
| `npm run terrain` | Rebuild the land albedo texture from Natural Earth |
| `npm run fonts` | Re-subset and re-embed the typefaces |
| `npm run deploy` | Build and publish to GitHub Pages |

Nothing is fetched at runtime. The map data, the three typefaces and every
asset are compiled in, so the single file build runs from a local disk or inside
a sandbox with no network at all.

## How it is put together

```
src/solar/      solar position, sunrise and sunset, the analemma, the seasons
src/time/       time zone arithmetic, built entirely on Intl
src/data/       the packed world data and the spatial lookups over it
src/render/     WebGL2 renderer, the colour ramps, the vector overlay
src/app/        the shell, the console, the scrubbers
scripts/        the build time data and font pipelines
docs/research/  the sources every number in here came from
```

The scene is composited in linear light into a half float framebuffer and tone
mapped once at the end. Only two things are allowed above 1.0, the sun glint on
the water and the cores of the brightest cities, which is what makes the bloom
mean something. The vector work sits on a separate 2D canvas, deliberately
outside that buffer, because hairlines and type should not bloom.

Land, lakes, coastlines and borders are real geometry rather than a raster, so
they stay sharp at every zoom. The city lights are 7,342 real places from
Natural Earth, sized by the logarithm of their population and dimmed as they
grow so that zooming in does not brighten a continent.

## Credits

Cartography from [Natural Earth](https://www.naturalearthdata.com), which is in
the public domain. Type is Bodoni Moda, Archivo and Martian Mono, all under the
SIL Open Font License; see `THIRD-PARTY.md`. The colour and accuracy work rests
on the sources catalogued in `docs/research/`.
