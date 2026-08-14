# WebGL2 implementation craft for the heliograph

Reference document for the implementer. Everything here is either quoted from a primary
source with a URL, or measured on this machine with a script whose output is reproduced
verbatim. Anything I could not verify is tagged **UNVERIFIED**.

Conventions used throughout:

* World longitude/latitude are WGS84 degrees, lon in `[-180, 180)`, lat in `[-90, 90]`.
* Equirectangular "world space" is `x = (lon + 180) / 360` in `[0, 1)` and
  `y = (90 - lat) / 360` in `[0, 0.5]`. Both axes use the same unit, so one world unit is
  the same number of screen pixels horizontally and vertically, and the map is naturally 2:1.
* "Backing pixels" means `canvas.width` / `canvas.height` (the drawing buffer), never CSS pixels.

---

## 0. Environment probe (measured, this machine, 2026-08-14)

Everything in section 9 and several numbers elsewhere come from these runs. Machine:
Windows 11, Node v24.18.0, Playwright 1.62.1, bundled `chromium-1234`, launched headless
with **no extra flags**.

```
webgl2:    true
vendor:    Google Inc. (Google)
renderer:  ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
version:   WebGL 2.0 (OpenGL ES 3.0 Chromium)
glsl:      WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)
MAX_TEXTURE_SIZE:         8192
MAX_RENDERBUFFER_SIZE:    8192
MAX_VIEWPORT_DIMS:        [8192, 8192]
ALIASED_POINT_SIZE_RANGE: [1, 1023]
ALIASED_LINE_WIDTH_RANGE: [1, 1]
MAX_SAMPLES:              4
MAX_TEXTURE_MAX_ANISOTROPY_EXT: 16
drawingBufferColorSpace:  "srgb"
fragment highp float:  rangeMin 127, rangeMax 127, precision 23   (IEEE float32)
fragment mediump float: rangeMin 15, rangeMax 15, precision 10    (IEEE float16)
OES_texture_float_linear: present
EXT_color_buffer_float:   present
```

Shader/format capability probe (all returned `GL_NO_ERROR`, all shaders compiled):

```
fwidth() in ESSL 300:          compiles
textureGrad():                 compiles
textureLod(), texelFetch():    compile
NPOT 300x150 texture with REPEAT wrap + generateMipmap:  no error
texStorage2D SRGB8_ALPHA8:     no error
texStorage2D R8 / R16F / R32F / RG8 + LINEAR filter:     no error
```

Screenshot determinism (`locator.screenshot()` on a WebGL2 canvas, three consecutive
captures, SHA-256 of the PNG bytes):

```
preserveDrawingBuffer=false dsf=1:  d0bfbcf031b51bf9 x3   (945 bytes)
preserveDrawingBuffer=false dsf=2:  b966b06b8863eb79 x3   (1790 bytes)
preserveDrawingBuffer=true  dsf=1:  d0bfbcf031b51bf9 x3
preserveDrawingBuffer=true  dsf=2:  b966b06b8863eb79 x3
```

**The single most consequential number here is `MAX_TEXTURE_SIZE = 8192`.** Your dev
machine will report 16384 on any modern discrete GPU, but CI runs on SwiftShader and will
reject a 16384-wide texture. Design for 8192 as the hard ceiling, or feature-detect and
degrade.

---

## 1. Getting land and ocean onto the screen from GeoJSON

### 1.1 What the source data actually contains (measured)

I downloaded the Natural Earth land polygons from
<https://github.com/martynafford/natural-earth-geojson> (mirror of
<https://www.naturalearthdata.com/>, public domain) and counted them:

| dataset | bytes (raw GeoJSON) | features | polygons | rings | holes | vertices |
|---|---|---|---|---|---|---|
| `ne_110m_land` |    237,355 |   127 |   127 |   128 | 1 |   5,143 |
| `ne_50m_land`  |  2,764,441 | 1,420 | 1,421 | 1,422 | 1 |  60,669 |
| `ne_10m_land`  | 18,292,962 |    10 | 4,064 | 4,065 | 1 | 411,137 |

Segment lengths along the coastline (great-circle approximation, km):

| dataset | segments | p10 | median | mean | p90 | total coastline |
|---|---|---|---|---|---|---|
| `110m` |   5,014 | 34.6 | 62.9 | 71.5 | 120.8 | 358,000 km |
| `50m`  |  59,247 |  3.0 |  7.6 | 10.1 |  19.7 | 596,000 km |
| `10m`  | 407,072 |  0.65|  1.57|  2.26|   4.45| 918,000 km |

Antimeridian check (measured):

```
110m: lon[-180.0, 180.00000000000014] rings_touching_180=7  consecutive_lon_jumps>180=1
50m:  lon[-180.0, 180.0]              rings_touching_180=11 consecutive_lon_jumps>180=0
10m:  lon[-180.0, 180.00000000000014] rings_touching_180=11 consecutive_lon_jumps>180=0
```

**Natural Earth land is already cut at the antimeridian.** Rings that reach the
antimeridian terminate exactly on `+/-180`. You do not need `d3-geo` antimeridian cutting
or a polygon clipper for this dataset. The one "jump" in the 110m file is Antarctica
closing itself along the south pole:

```
[178.277, -84.473], [180.0, -84.713], [180.0, -90.0], [-180.0, -90.0], [-180.0, -84.713]
```

which is a legitimate straight run along the bottom edge of the equirectangular plane, and
triangulates correctly. Nothing to fix. (The `10m` Antarctic ring has 15,961 vertices and
does the same thing.)

> Do not assume the same is true of other layers. `d3-geo` documents that
> "geometries that cross the antimeridian line are cut in two, one on each side" as a
> preclip step, and that GeoJSON in planar equirectangular coordinates "may require
> stitching to remove antimeridian cuts".
> <https://d3js.org/d3-geo>

### 1.2 Option (a): rasterise to an offscreen 2D canvas, upload as a texture

```js
// build step or startup: rasterise land into an RGBA/alpha mask
export function rasteriseLand(geojson, texW) {
  const texH = texW >> 1;                    // equirectangular is exactly 2:1
  const cv = new OffscreenCanvas(texW, texH);
  const ctx = cv.getContext('2d', { alpha: true, willReadFrequently: false });
  ctx.imageSmoothingEnabled = false;         // irrelevant for path fills, set anyway
  ctx.fillStyle = '#fff';

  const sx = texW / 360, sy = texH / 180;
  const path = new Path2D();
  for (const f of geojson.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {            // ring 0 = outer, 1.. = holes
        path.moveTo((ring[0][0] + 180) * sx, (90 - ring[0][1]) * sy);
        for (let i = 1; i < ring.length; i++) {
          path.lineTo((ring[i][0] + 180) * sx, (90 - ring[i][1]) * sy);
        }
        path.closePath();
      }
    }
  }
  ctx.fill(path, 'evenodd');                 // even-odd punches the holes for free
  return cv;
}
```

Notes on that snippet:

* Use **one** `Path2D` and **one** `fill()` call with the `'evenodd'` fill rule. The
  `CanvasFillRule` enum ("nonzero" and "evenodd") is standard;
  <https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fill>.
  Filling ring by ring instead would double-composite the antialiased edges of adjacent
  rings and leave visible hairlines.
* Canvas 2D path fills are antialiased by the implementation and there is **no API to turn
  path antialiasing on or off**. `imageSmoothingEnabled` / `imageSmoothingQuality`
  ("low" | "medium" | "high") only affect `drawImage` resampling, not path rasterisation:
  <https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingQuality>.
  So you get antialiased coastlines automatically, but only at the texture's own resolution.
* `OffscreenCanvas` is Baseline widely available since March 2023 and works in workers:
  <https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas>. Rasterise in a worker
  at startup so the main thread stays responsive.

Upload, with the wrap modes that matter:

```js
const tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);          // we already flipped in the path math
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
gl.texStorage2D(gl.TEXTURE_2D, mipLevels(texW, texH), gl.R8, texW, texH);
gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RED, gl.UNSIGNED_BYTE, canvasOrImageData);
gl.generateMipmap(gl.TEXTURE_2D);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);          // longitude wraps
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);   // latitude does NOT
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
    Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
```

* `texStorage2D` + `texSubImage2D` rather than `texImage2D` is MDN's explicit WebGL 2
  recommendation: "Some drivers unconditionally allocate the whole mip-chain (+30% memory!)
  even if you only want a single level. Prefer texStorage + texSubImage for textures in
  WebGL 2."
  <https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices>
* NPOT sizes are fine. WebGL 2 spec: "unlike the WebGL 1.0 API, there are no special
  restrictions on non power of 2 textures. All mipmapping and all wrapping modes are
  supported for non-power-of-two images."
  <https://registry.khronos.org/webgl/specs/latest/2.0/> (Non-Power-of-Two Texture Access).
  I confirmed a 300x150 texture with `REPEAT` + `generateMipmap` produces no error on
  SwANGLE (probe above). Still prefer a power-of-two width like 8192 so the mip chain is exact.

**The seam at +/-180.** Two rules, and they are not optional:

1. `TEXTURE_WRAP_S = REPEAT`, `TEXTURE_WRAP_T = CLAMP_TO_EDGE`. `REPEAT` makes the linear
   filter blend the last texel column with the first, which is exactly correct for an
   equirectangular map. `CLAMP_TO_EDGE` on T stops the north pole bleeding into the south pole.
2. **Never call `fract()` on the u coordinate before sampling.** `fract()` creates a
   discontinuity of magnitude 1.0 at one fragment column. `texture()` picks its mip level
   from `dFdx/dFdy` of the coordinate, so at that column the derivative is enormous, the
   sampler drops to the 1x1 mip, and you get a one-pixel-wide grey stripe running pole to
   pole. Pass the unwrapped coordinate and let `REPEAT` do the wrapping. If you genuinely
   must wrap in the shader, use `textureGrad(tex, fract(uv), dFdx(uvUnwrapped), dFdy(uvUnwrapped))`
   (verified to compile in ESSL 300 above).

**Memory and resolution.** Equirectangular texture width `W_tex` covers 360 degrees. On a
screen `W_px` backing pixels wide showing `360 / z` degrees of longitude, texels per screen
pixel is:

```
texels_per_pixel = W_tex / (z * W_px)
```

so the raster stays at or above 1:1 only while `W_tex >= z * W_px`.

| `W_tex` | R8 bytes (+mips) | ground res at equator | crisp up to (3840 px wide screen) |
|---|---|---|---|
|  4096 |   8.4 MB / 11.2 MB | 9,784 m | z = 1.07 |
|  8192 |  33.6 MB / 44.7 MB | 4,892 m | z = 2.13 |
| 16384 | 134.2 MB / 179 MB  | 2,446 m | z = 4.27 |
| 32768 | 537 MB             | 1,223 m | z = 8.5 (exceeds every real `MAX_TEXTURE_SIZE`) |

(Equatorial circumference 40,075.017 km, WGS84.)

Cross-check against the data's own fidelity: the `10m` land has a **median coastline
segment of 1.57 km and a p10 of 0.65 km**. An 8192-wide raster samples at 4.9 km, so it
discards roughly two thirds of the detail that is actually in the file. The `50m` data
(median 7.6 km) is fully captured by an 8192-wide raster with room to spare.

**Verdict for (a):** a raster mask alone cannot stay crisp at 8x zoom on a 4K display.
You would need a 30,720-wide texture and `MAX_TEXTURE_SIZE` is 8192 in CI and typically
16384 on desktop GPUs. WebGL2Fundamentals is blunt about the ceiling: "2048 or 4096 seems
to be reasonable limits. At least as of 2020 it looks like 99% of devices support 4096 but
only 50% support > 4096."
<https://webgl2fundamentals.org/webgl/lessons/webgl-cross-platform-issues.html>

### 1.3 Option (b): triangulate with earcut and draw real geometry

Measured on this machine with `earcut@3` (Node v24.18.0), triangulating every ring of each
dataset with `flatten()` + `earcut()` + `deviation()`:

| dataset | polygons | triangles | earcut time | max `deviation()` | non-indexed vec2 f32 VBO |
|---|---|---|---|---|---|
| `110m` |   127 |   4,763 |   6.5 ms | 2.90e-14 | 0.11 MiB |
| `50m`  | 1,421 |  56,406 |  17.0 ms | 2.03e-11 | 1.29 MiB |
| `10m`  | 4,064 | 398,928 | 135.0 ms | 3.35e-11 | 9.13 MiB |

`deviation()` "calculates the relative difference between the total area of triangles and
the area of the input polygon. 0 means the triangulation is fully correct"
(<https://github.com/mapbox/earcut>). At 3e-11 the triangulation of the full 10m land is
correct to floating point noise. Earcut's own README warns it "does not guarantee a correct
triangulation on arbitrary input" and "expects valid polygons without self-crossing,
overlapping holes, or duplicate edges"; Natural Earth land satisfies that, and the measured
deviation proves it here.

Indexed is much smaller: 411,137 unique positions x 8 bytes = 3.3 MB positions, plus
398,928 x 3 x 4 bytes = 4.8 MB `Uint32` indices. Earcut returns indices local to each ring
group, so offset them as you concatenate.

```js
import earcut, { flatten } from 'earcut';

export function triangulateLand(geojson) {
  const positions = [];   // world-space x in [0,1), y in [0,0.5]
  const indices = [];
  for (const f of geojson.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      const { vertices, holes, dimensions } = flatten(poly);
      const base = positions.length / 2;
      for (let i = 0; i < vertices.length; i += dimensions) {
        positions.push((vertices[i] + 180) / 360, (90 - vertices[i + 1]) / 360);
      }
      const tri = earcut(vertices, holes, dimensions);
      for (let i = 0; i < tri.length; i++) indices.push(base + tri[i]);
    }
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),      // needs > 65535, fine in WebGL2 core
  };
}
```

Do this **at build time**, not at runtime. 135 ms of main-thread jank at startup is
avoidable: run the above in a Node script, write `Float32Array` + `Uint32Array` to a
`.bin`, and `fetch()` it. Rounding positions to `Uint16` fixed point (1/65536 of the world
width = 0.0055 degrees = 610 m at the equator) halves the position buffer but throws away
detail the 10m data has, so keep `Float32`.

**Wrap-around for geometry.** Draw the same index buffer up to three times with a uniform
`u_worldXOffset` of `-1.0`, `0.0`, `+1.0` and skip the copies whose world-space AABB does
not intersect the view. Three `drawElements` calls instead of one is free at this triangle
count.

**Antialiasing for geometry.** The default drawing buffer has `antialias: true` and in
WebGL 2 that attribute "must be obeyed by the WebGL implementation"
(<https://registry.khronos.org/webgl/specs/latest/2.0/>, The Drawing Buffer). SwANGLE
reports `MAX_SAMPLES = 4`. So triangle edges get 4x MSAA for free at any zoom. If you
render into an offscreen FBO for post-processing you lose that and must go through
`renderbufferStorageMultisample` + `blitFramebuffer`
(<https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/renderbufferStorageMultisample>);
WebGL 2 has no multisampled *texture* attachments, only multisampled renderbuffers.

### 1.4 Which is better when the user can zoom 8x, and why

**Neither, alone. Use geometry for the land/ocean *mask* and a distance field for the
*shading*, and do all shading in one full-screen pass.** Concretely:

1. **Build step:** `earcut` the 10m land into a static index/position buffer (measured 399k
   triangles, 8 MB indexed, 135 ms offline).
2. **Startup:** render that geometry once into an offscreen `R8` texture at 8192x4096 to
   get a land mask, and once into a signed distance field (section 2). Re-render the mask
   only if you ever change datasets.
3. **Every frame:** draw ONE full-screen triangle. The fragment shader converts
   `gl_FragCoord` to lon/lat, samples the SDF, computes the solar elevation angle, and
   outputs the colour. Coastline antialiasing comes from `fwidth()` on the SDF, so it is
   *analytically correct at every zoom level*, including 8x, and it costs nothing.

The reasoning:

* Raw raster mask alone: fails at 8x, quantified above. A 2x-undersampled binary mask shows
  visible stair-stepping that MSAA cannot help, because the aliasing is in the texture, not
  in the geometry.
* Raw geometry alone: crisp coastlines at any zoom via MSAA, but you cannot cheaply answer
  "how far is this ocean pixel from the nearest coast?", which you need for continental
  shelf shading and coastal glow. And the twilight gradient is a per-pixel function anyway,
  so you are drawing a full-screen pass regardless, and there is no reason to also
  rasterise 399k triangles every frame.
* SDF from geometry: gets you the crisp edge of geometry, the O(1) sampling of a raster,
  *and* the distance queries, at 8192x4096 (33.6 MB as `R8`, 67 MB as `R16F`). This is the
  answer.

Keep the earcut geometry around anyway. It is the only cheap way to render an exact,
MSAA'd land silhouette if you ever want one (for example a crisp coastline stroke at 8x
that must be pixel-exact rather than SDF-approximate), and it is what you rasterise the
SDF from.

---

## 2. A distance field for the coastline

### 2.1 Which algorithm

Recommendation: **Felzenszwalb and Huttenlocher's separable exact Euclidean distance
transform, computed once at build time on the CPU.**

Reasons:

* It is **exact** (it computes the true squared Euclidean distance, not an approximation),
  and **O(n)** in the number of cells. From the paper: the 1D lower-envelope-of-parabolas
  pass "achieves O(n) time complexity", and the 2D case is done by "apply the 1D algorithm
  along each row, apply the 1D algorithm along each column of intermediate results".
  <https://cs.brown.edu/people/pfelzens/papers/dt-final.pdf>
* Meijster/Roerdink/Hesselink is also exact and linear time
  (<https://fab.cba.mit.edu/classes/S62.12/docs/Meijster_distance.pdf>) and is a perfectly
  good alternative; there is no meaningful quality or complexity difference. Felzenszwalb
  wins on availability of a battle-tested, tiny JS implementation (below). Saito's
  algorithm is exact but historically the slowest of the three in practice; **UNVERIFIED**,
  I did not benchmark it.
* Jump flooding is **not** exact. Wikipedia: "It is only an approximate algorithm and does
  not always compute the correct result for every pixel, although in practice errors are
  few and the magnitude of errors is generally small", and it costs `O(N^2 log2 N)` total
  work, "9 log2(N) times over each pixel".
  <https://en.wikipedia.org/wiki/Jump_flooding_algorithm>
  Use it only if you decide to recompute the field at runtime (you will not, the coastline
  is static). The variants worth knowing if you do: **1+JFA** (one extra pass at step 1
  *before* the normal sequence) achieves "very low error rate (similar to JFA+2)".

### 2.2 The exact EDT implementation to copy

This is `mapbox/tiny-sdf`'s implementation, which explicitly cites the Felzenszwalb paper.
It is public, tiny, and correct. Source: <https://github.com/mapbox/tiny-sdf/blob/main/index.js>
(BSD-2-Clause). Reproduced verbatim:

```js
const INF = 1e20;

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher
// https://cs.brown.edu/~pff/papers/dt-final.pdf
function edt(data, x0, y0, width, height, gridSize, f, v, z) {
    for (let x = x0; x < x0 + width; x++) edt1d(data, y0 * gridSize + x, gridSize, height, f, v, z);
    for (let y = y0; y < y0 + height; y++) edt1d(data, y * gridSize + x0, 1, width, f, v, z);
}

// 1D squared distance transform
function edt1d(grid, offset, stride, length, f, v, z) {
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    f[0] = grid[offset];

    for (let q = 1, k = 0, s = 0; q < length; q++) {
        f[q] = grid[offset + q * stride];
        const q2 = q * q;
        do {
            const r = v[k];
            s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
        } while (s <= z[k] && --k > -1);

        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }

    for (let q = 0, k = 0; q < length; q++) {
        while (z[k + 1] < q) k++;
        const r = v[k];
        const qr = q - r;
        grid[offset + q * stride] = f[r] + qr * qr;
    }
}
```

`s = (f[q] - f[r] + q*q - r*r) / (q - r) / 2` is exactly the paper's intersection formula
`s = ((f(q)+q^2) - (f(v[k])+v[k]^2)) / (2q - 2v[k])`.

`edt()` returns **squared** distance. Take `Math.sqrt` at the end.

**Signed** distance the tiny-sdf way: run two EDTs, one seeded from outside the shape and
one from inside, and subtract the square roots:

```js
// signed distance = sqrt(outer) - sqrt(inner); positive OUTSIDE the shape
const d = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
```

tiny-sdf also handles antialiased source pixels rather than a hard binary mask, which
materially improves subpixel accuracy of the zero crossing. Its trick, verbatim:

```js
// lookup table for gamma-corrected, signed squared alpha distance values
const alphaTable = new Float64Array(256);
for (let i = 0; i < 256; i++) {
    const d = 0.5 - Math.pow(i / 255, 1 / 2.2);
    alphaTable[i] = d * Math.abs(d);
}
alphaTable[255] = -INF;
// ...
const a = imgData.data[imgIdx];          // alpha of the antialiased rasterisation
if (a === 0) continue;
const t = alphaTable[a];
gridOuter[j] = Math.max(0, t);           // note: these grids hold SQUARED distances
gridInner[j] = Math.max(0, -t);
```

That is: a fully covered pixel gets outer 0 / inner INF, an empty pixel gets outer INF /
inner 0, and a 50%-covered pixel gets 0 for both, meaning the edge passes through its
centre. Feed it your antialiased Canvas 2D rasterisation of the land polygons from 1.2
and you get subpixel-accurate coastlines.

### 2.3 Two things you must get right for a world map

**(a) Wrap the grid horizontally before you run the EDT.** A plain EDT treats the image
edges as boundaries, so a pixel near lon `+179.9` would measure its distance to land at
`-179.9` as "the whole width of the map" instead of "0.2 degrees". Fix: build a
`3 * W` wide mask (the mask tiled three times horizontally), run the EDT on the whole
thing, and crop the centre `W` columns. Correct as long as your maximum encoded distance
is `<= W` texels, which it always is.

```js
const W = 8192, H = 4096;
const wide = new Float64Array(3 * W * H);
for (let y = 0; y < H; y++)
  for (let k = 0; k < 3; k++)
    wide.set(maskRow(y), y * 3 * W + k * W);
edt(wide, 0, 0, 3 * W, H, 3 * W, f, v, z);
// then read columns [W, 2W) of each row
```

Memory for that: `3 * 8192 * 4096` `Float64` = 805 MB per grid, and you need two grids
(inner and outer). Too much. Two mitigations, either works:

* Change the typed arrays from `Float64Array` to `Float32Array` (halves it to 403 MB per
  grid). `f`, `z` also become `Float32Array`. Squared distances up to `(3*8192)^2 = 6e8`
  are exactly representable in float32 (integers below 2^24 are exact, 6e8 is not, but the
  error is < 64 in a squared distance of 6e8, i.e. < 0.001 texels after the sqrt).
  **UNVERIFIED** in practice, I did not run the 8192-wide EDT.
* Or, better, do not tile 3x. Pad by only `M` columns on each side where `M` is the maximum
  distance you will ever encode (say 512 texels = 2,500 km at the equator), giving a
  `W + 2M` grid, and clamp distances beyond `M`. A `(8192 + 1024) x 4096` `Float32` grid is
  151 MB, and you need two, which is comfortable. Run it in Node with
  `--max-old-space-size=4096`.

**(b) The equirectangular grid is not a metric space.** A Euclidean EDT in equirectangular
pixels measures distance in a coordinate system that stretches longitude by `1/cos(lat)`.
At 60 degrees N one horizontal texel is half the ground distance of one vertical texel.
Consequences:

* For **antialiasing** this does not matter at all. Near the coast (within a few texels)
  the anisotropy factor is effectively constant, so the zero crossing is in the right place
  and the field is merely anisotropically scaled. Since you antialias with `fwidth()` of
  the *same* field measured in *screen* space, the scaling cancels out.
* For **continental shelf shading and coastal glow at large radii**, the halo will look
  wider in longitude than in latitude at high latitudes. Correct it in the shader by
  converting to approximate ground distance:
  `float km = d_texels * (40075.017 / float(TEX_W)) * ... ` for the horizontal component
  only. The cheap fix that looks right: scale the *threshold*, not the field:
  `float shelf = smoothstep(0.0, shelfTexels / max(cos(radians(lat)), 0.2), -d);`
* If you want it truly geodesic you would need to run the EDT on a sphere-sampled grid,
  which is a much bigger project. Not worth it here. **UNVERIFIED** whether the artefact is
  actually visible at the halo widths you will use; check it at 70 degrees N.

### 2.4 Packing it into a texture with enough precision

The question is what dynamic range you need. You need two very different things from one
field:

* Near the coast: sub-texel precision, because that is what makes the shoreline crisp.
* Far from the coast: a few hundred texels of range, for shelf and inland shading.

Options, with real numbers for an 8192x4096 field:

| encoding | bytes | precision near coast | max range | notes |
|---|---|---|---|---|
| `R8`, linear over +/-8 texels | 33.6 MB | 16/255 = 0.063 texels | 8 texels | tiny-sdf style; great AA, useless for shelf |
| `R8`, linear over +/-512 texels | 33.6 MB | 4.0 texels | 512 | shoreline is a 4-texel-wide mush; unusable |
| `RG8`, R = near +/-8, G = far +/-512 | 67 MB | 0.063 texels | 512 | works, two lookups, needs a blend at the handover |
| `R16F` | 67 MB | ~0.0005 texels at d=1 | 65504 | **recommended** |
| `R32F` | 134 MB | exact | huge | overkill; also `LINEAR` needs `OES_texture_float_linear` |

**Recommendation: `R16F`.** IEEE float16 has a 10-bit explicit mantissa (measured:
`getShaderPrecisionFormat(FRAGMENT_SHADER, MEDIUM_FLOAT).precision === 10`), so relative
precision is about 2^-11 = 0.05%. At a distance of 1 texel that is 0.0005 texels, which is
far finer than you can see. At 512 texels it is 0.25 texels, which is invisible in a halo.
Half-float linear filtering is **core in WebGL 2**: the spec lists
`OES_texture_half_float_linear` among the extensions "made core in WebGL 2.0"
(<https://registry.khronos.org/webgl/specs/latest/2.0/>), and I verified `texStorage2D`
with `R16F` plus a `LINEAR` min filter produces no error on SwANGLE. `R32F` does **not**
get free linear filtering (`OES_texture_float_linear` is explicitly excluded from the
core list, though it happened to be present in my probe).

Encode the distance in **texels of the source grid**, not in kilometres or normalised
units. Texels is the unit the shader wants for `fwidth()` maths, and it keeps the numbers
in the sweet spot of float16.

**Shipping the field offline.** `R16F` at 8192x4096 is 67 MB of raw bytes. Options:

* Ship a raw `Uint16Array` `.bin` of the IEEE half-float bit patterns and upload directly:
  `gl.texSubImage2D(..., gl.RED, gl.HALF_FLOAT, u16array)`. Vite will inline it as an asset
  with `?url`. 67 MB is a lot for an offline app.
* Halve the field to 4096x2048 (16.8 MB). **This is the right call.** An SDF is a smooth
  field, so it upsamples with bilinear filtering far more gracefully than a binary mask
  does. Compute the EDT at 8192x4096 (or 16384x8192) for accuracy, then box-downsample the
  *distance values*. The zero crossing stays where it belongs; you only lose coastline
  features narrower than a coarse texel (small islands, fjord mouths). Keep a separate
  high-resolution `R8` binary mask if you need those.
* Alternative if you want a browser-decodable format: split the half-float into two bytes
  and store as an RGBA8 PNG (hi byte in R, lo in G). PNG's filters compress a smooth
  hi-byte plane extremely well. **If you do this you must defeat colour management on
  decode**, or the browser will apply a transfer curve to your data bytes:

```js
const bmp = await createImageBitmap(blob, {
  colorSpaceConversion: 'none',   // default is 'default' = implementation-specific
  premultiplyAlpha: 'none',       // default is 'default'
  imageOrientation: 'none',       // default is 'from-image' (honours EXIF!)
});
```

Those three defaults are all wrong for data textures. Documented at
<https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap>.

### 2.5 What the field unlocks (with GLSL)

Sign convention used below: **`d > 0` on land, `d < 0` in ocean**, in units of source
texels.

```glsl
#version 300 es
precision highp float;

uniform sampler2D u_sdf;      // R16F, signed distance in source texels
uniform vec2  u_sdfTexel;     // 1.0 / vec2(TEX_W, TEX_H)
uniform float u_texelsPerPixel;   // source texels covered by one screen pixel at this zoom
in  vec2 v_uv;                // unwrapped equirectangular uv; wrap is done by REPEAT
out vec4 o_color;

float sdf(vec2 uv) { return texture(u_sdf, uv).r; }

void main() {
    float d = sdf(v_uv);

    // ---- (1) antialiased shoreline at ANY zoom -------------------------------
    // fwidth measures how much d changes across one screen pixel. Because we never
    // fract() v_uv, this is continuous everywhere including the seam.
    float w = fwidth(d);
    float land = clamp(0.5 + d / max(w, 1e-5), 0.0, 1.0);   // 1 = land, 0 = ocean

    // ---- (2) glowing coast ---------------------------------------------------
    // Exponential falloff on the ocean side only, in SCREEN pixels so the glow keeps
    // a constant apparent thickness as you zoom.
    float dPix   = d / max(u_texelsPerPixel, 1e-5);         // signed distance in screen px
    float glow   = exp(-max(-dPix, 0.0) / 6.0);             // 6 px e-folding

    // ---- (3) continental shelf -----------------------------------------------
    // In world texels, not screen pixels: the shelf is a real feature with a real width.
    const float SHELF = 40.0;                                // texels; ~200 km at 8192 wide
    float shelf = 1.0 - smoothstep(-SHELF, 0.0, d);          // 1 at the coast, 0 offshore
    shelf = 1.0 - shelf;                                     // invert to taste

    // ---- (4) inland shading ---------------------------------------------------
    // Distance inland, for continentality / aridity tinting.
    float inland = smoothstep(0.0, 120.0, d);                // 0 at coast, 1 deep inland

    vec3 ocean = mix(u_deepOcean, u_shelfOcean, shelf);
    vec3 soil  = mix(u_coastLand, u_interiorLand, inland);
    vec3 c     = mix(ocean, soil, land);
    c += u_coastGlowColor * glow * (1.0 - land);

    o_color = vec4(c, 1.0);
}
```

Notes:

* `clamp(0.5 + d / fwidth(d), 0, 1)` is the standard exact-coverage approximation for an
  SDF edge; the `smoothstep(-w, w, d)` variant is smoother but slightly blurrier. Both are
  in wide use; see
  <http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/> and
  <https://blog.pkh.me/p/44-perfecting-anti-aliasing-on-signed-distance-functions.html>.
  MDN/Khronos confirm `fwidth` is core in GLSL ES 3.00 (no extension needed, unlike ES 1.00
  which required `OES_standard_derivatives`); I verified it compiles on SwANGLE.
* `u_texelsPerPixel` should be `TEX_W / (z * canvasWidth)` from section 3's zoom model.
  Pass it as a uniform rather than deriving it from `fwidth`, so the glow width is stable
  and does not shimmer.
* The Valve technique this all descends from is Chris Green, "Improved alpha-tested
  magnification for vector textures and special effects", SIGGRAPH 2007 courses,
  <https://dl.acm.org/doi/10.1145/1281500.1281665>. It is the canonical citation for
  "soft edges, outlining, drop shadows" from a single distance channel.

### 2.6 If you do decide to use jump flooding on the GPU

For completeness. Store the *seed coordinate* per texel, not the distance:

```glsl
// pass N: uniform float u_step;  ping-pong between two RG16F (or RG32F) textures
#version 300 es
precision highp float;
uniform sampler2D u_prev;   // .rg = uv of the nearest seed so far, or (-1,-1) for none
uniform vec2  u_texel;
uniform float u_step;       // in texels: N/2, N/4, ... , 1
in  vec2 v_uv;
out vec2 o_seed;

void main() {
    vec2  best = texture(u_prev, v_uv).rg;
    float bestD = (best.x < 0.0) ? 1e20 : distance(v_uv, best);
    for (int j = -1; j <= 1; ++j) {
        for (int i = -1; i <= 1; ++i) {
            vec2 s = texture(u_prev, v_uv + vec2(float(i), float(j)) * u_step * u_texel).rg;
            if (s.x < 0.0) continue;
            float dd = distance(v_uv, s);
            if (dd < bestD) { bestD = dd; best = s; }
        }
    }
    o_seed = best;
}
```

Driver loop, per Rong and Tan 2006 (i3D) and the Wikipedia summary:

```js
// steps N/2, N/4, ..., 1 ; prepend a step of 1 for the "1+JFA" variant (much lower error)
const steps = [1];
for (let s = N >> 1; s >= 1; s >>= 1) steps.push(s);
for (const s of steps) { bindPingPong(); gl.uniform1f(uStep, s); drawFullscreen(); }
// final pass: signed distance = distance(uv, seed) * (inside ? -1 : +1)
```

Run it twice, once seeded from land texels and once from ocean texels, and subtract, to get
a signed field. `RG16F` seeds are enough precision for an 8192-wide grid (**UNVERIFIED**:
float16 has 11 significand bits, and 8192 needs 13, so you should store seeds in
*normalised uv* which keeps them in [0,1] where float16 has 2^-11 relative precision, i.e.
about 4 texels of absolute error at 8192. That is not enough. Use `RG32F`.) This is
another reason to do the EDT on the CPU at build time.

---

## 3. Panning and zooming an equirectangular map

### 3.1 The transform

Keep one authoritative view state and derive everything else:

```ts
interface View {
  cx: number;   // world x of the viewport centre, in [0, 1), wraps
  cy: number;   // world y of the viewport centre, in [0, 0.5], clamped
  z:  number;   // zoom: at z = 1 the full 360 degrees exactly fills the canvas width
}
// derived
const scale = (v: View, W: number) => v.z * W;   // backing pixels per world unit
```

Forward and inverse, in the same algebra `d3-zoom` uses (`apply` is `x*k + tx`, `invert`
is `(x - tx) / k`; <https://d3js.org/d3-zoom>):

```ts
function worldToScreen(v: View, W: number, H: number, wx: number, wy: number) {
  const s = v.z * W;
  return [ (wx - v.cx) * s + W / 2, (wy - v.cy) * s + H / 2 ];
}
function screenToWorld(v: View, W: number, H: number, px: number, py: number) {
  const s = v.z * W;
  return [ (px - W / 2) / s + v.cx, (py - H / 2) / s + v.cy ];
}
function worldToLonLat(wx: number, wy: number) {
  return [ (wx - Math.floor(wx)) * 360 - 180, 90 - wy * 360 ];
}
```

In the full-screen-pass fragment shader, feed the inverse straight in:

```glsl
uniform vec2  u_res;        // backing pixels
uniform vec2  u_centre;     // cx, cy in world units
uniform float u_scale;      // z * u_res.x, backing pixels per world unit

vec2 fragToWorld() {
    return (gl_FragCoord.xy - 0.5 * u_res) / u_scale + u_centre;
}
// NOTE gl_FragCoord.y grows upward while world y grows southward, so either negate
// the y term here or flip once when you build u_centre. Pick one and be consistent.
```

### 3.2 Wrap-around at the antimeridian

Three separate mechanisms, one per kind of content:

1. **Full-screen shader pass:** nothing to do. `u_centre.x` may be any real number.
   Sampling uses `REPEAT` (section 1.2) and wraps for free. Just normalise `cx` back into
   `[0,1)` after every gesture so it never grows large enough to lose float precision:
   `v.cx -= Math.floor(v.cx)`.
2. **Geometry (land triangles, timezone borders, graticule):** draw up to three copies at
   `u_worldXOffset` of `-1, 0, +1`, culling by AABB. Visible copies:
   `Math.ceil(1 / v.z) + 1` at most.
3. **Point sprites (city lights):** same three-copy trick, or add `+/-1` to the instance's
   world x in the vertex shader by picking the copy that lands nearest the viewport centre:

```glsl
float wx = a_worldX + u_copyOffset;      // -1, 0, +1 from a per-draw uniform
```

**Never** try to be clever with `mod()` on the CPU side alone. A polygon whose vertices
straddle the seam will render as a horizontal smear across the whole map if you wrap
per-vertex. Wrap per-*draw*, not per-vertex.

### 3.3 Clamping at the poles

Longitude wraps, latitude does not. The map is 0.5 world units tall. Clamp so the map never
detaches from a viewport edge, and centre it when it is smaller than the viewport:

```ts
function clampY(v: View, H: number): number {
  const s = v.z * W;
  const halfViewport = (H / 2) / s;         // half viewport height in world units
  if (0.5 <= 2 * halfViewport) return 0.25; // map is shorter than the viewport: centre it
  return Math.min(Math.max(v.cy, halfViewport), 0.5 - halfViewport);
}
```

This is the same shape as `d3-zoom`'s default `constrain`, which returns the midpoint when
the content is smaller than the extent and otherwise pushes the nearer edge back:

```js
// d3-zoom default constraint, https://d3js.org/d3-zoom
function constrain(transform, extent, translateExtent) {
  var dx0 = transform.invertX(extent[0][0]) - translateExtent[0][0],
      dx1 = transform.invertX(extent[1][0]) - translateExtent[1][0],
      dy0 = transform.invertY(extent[0][1]) - translateExtent[0][1],
      dy1 = transform.invertY(extent[1][1]) - translateExtent[1][1];
  return transform.translate(
    dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
    dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
  );
}
```

Also clamp zoom: `z` in `[zMin, 8]` where `zMin = max(1, H / (0.5 * W))` so you can never
zoom out past "the map fills the viewport".

### 3.4 Cursor-anchored zoom

The invariant: the world point under the cursor stays under the cursor.

```ts
function zoomAt(v: View, W: number, H: number, px: number, py: number, factor: number): View {
  const [wx, wy] = screenToWorld(v, W, H, px, py);      // world point under cursor, OLD scale
  const z = clamp(v.z * factor, zMin, 8);
  const s = z * W;                                       // NEW scale
  const next: View = {
    z,
    cx: wx - (px - W / 2) / s,
    cy: wy - (py - H / 2) / s,
  };
  next.cx -= Math.floor(next.cx);
  next.cy = clampY(next, H);
  return next;
}
```

This is exactly `d3-zoom`'s `translateTo`: "New tx = px - k*x; New ty = py - k*y"
(<https://d3js.org/d3-zoom>), rearranged for a centre-based rather than a
translate-based parameterisation.

Wheel delta. Use d3's default, which normalises the three `deltaMode` values and treats
pinch-zoom (which Chrome reports as a `ctrlKey` wheel) specially:

```js
// d3-zoom default wheelDelta, https://d3js.org/d3-zoom
function wheelDelta(event) {
  return -event.deltaY *
    (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) *
    (event.ctrlKey ? 10 : 1);
}
// then: factor = Math.pow(2, wheelDelta(event));   // delta +1 doubles, -1 halves
```

Call `event.preventDefault()` on `wheel` and register the listener with `{ passive: false }`
or the browser will scroll the page instead.

### 3.5 Drag panning

Use Pointer Events with pointer capture so the drag survives the cursor leaving the canvas:

```ts
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  inertia.clear();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dpr = backingWidth / canvas.clientWidth;
  const dx = (e.clientX - drag.x) * dpr, dy = (e.clientY - drag.y) * dpr;
  drag.x = e.clientX; drag.y = e.clientY;
  const s = view.z * backingWidth;
  view.cx -= dx / s; view.cy -= dy / s;
  view.cx -= Math.floor(view.cx);
  view.cy = clampY(view, backingHeight);
  inertia.record({ panDelta: { x: dx, y: dy } });
  markDirty();
});
canvas.addEventListener('pointerup', (e) => { drag = null; inertia.release(); });
```

`setPointerCapture` "designates a specific element as the capture target for future pointer
events... even if the pointer moves outside the element's boundaries", and capture is
implicitly released on `pointerup`:
<https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture>.

Convert client coordinates to backing pixels with the same DPR you used to size the canvas,
or panning will drift relative to the cursor on a HiDPI display.

### 3.6 Inertial panning

Do not integrate a velocity with friction frame by frame. That drifts, behaves differently
at 60 Hz and 120 Hz, and needs a fixed timestep. Instead compute a **closed-form ease** at
release, exactly as MapLibre does. Verified source:
<https://github.com/maplibre/maplibre-gl-js/blob/main/src/ui/handler_inertia.ts>

```ts
// MapLibre's constants, verbatim
const defaultInertiaOptions = { linearity: 0.3, easing: bezier(0, 0, 0.3, 1) };
const defaultPanInertiaOptions  = { ...defaultInertiaOptions, deceleration: 2500, maxSpeed: 1400 };
const defaultZoomInertiaOptions = { ...defaultInertiaOptions, deceleration: 20,   maxSpeed: 1400 };
const BUFFER_CUTOFF   = 160;   // ms: maximum age of a recorded gesture update
const VELOCITY_WINDOW = 60;    // ms: window the gesture velocity is measured over
```

```ts
// MapLibre's calculateEasing, verbatim
function calculateEasing(amount, inertiaDuration /* ms */, inertiaOptions) {
    const {maxSpeed, linearity, deceleration} = inertiaOptions;
    const speed = clamp(
        amount * linearity / (inertiaDuration / 1000),
        -maxSpeed,
        maxSpeed);
    const duration = Math.abs(speed) / (deceleration * linearity);
    return {
        easing: inertiaOptions.easing,
        duration: duration * 1000,
        amount: speed * (duration / 2)
    };
}
```

The mechanics: keep a ring buffer of `{ time, panDelta }`, drop entries older than
`BUFFER_CUTOFF` (160 ms), on release sum the deltas over the last `VELOCITY_WINDOW` (60 ms),
feed the magnitude and the elapsed duration into `calculateEasing`, and then animate
`cx, cy` from their current values toward `current + finalPan` over `result.duration`
milliseconds using the cubic bezier `(0, 0, 0.3, 1)`. Because it is a closed-form function
of elapsed wall time, it is frame-rate independent and cannot drift.

MapLibre's comment on why the velocity window ends at release rather than at the last
recorded move is worth honouring: "so that a gesture held still before being released has a
lower velocity, down to no inertia at all". That is the difference between an inertia
implementation that feels right and one that flings when you did not mean to.

For 8x zoom, cap the inertia distance in *world* units, not screen pixels, or a fling at
8x will throw you a quarter of the way around the planet.

---

## 4. Device pixel ratio, canvas sizing, and staying sharp on 4K

### 4.1 The rule

Set `canvas.width` / `canvas.height` (the backing store, in device pixels) from a
`ResizeObserver`, never from `window.devicePixelRatio` alone, and never inside the render
loop. Let CSS size the element.

```css
#map { position: fixed; inset: 0; display: block; width: 100%; height: 100%; }
```

```ts
let backingW = 0, backingH = 0, needsResize = false;

const MAX_BACKING_PIXELS = 8_294_400;   // 3840 x 2160
const MAX_BACKING_DIM    = 8192;        // MAX_TEXTURE_SIZE floor, and MAX_VIEWPORT_DIMS

function onResize(wDev: number, hDev: number) {
  // budget clamp: keep total fragment count bounded on 5K/8K displays
  let scale = Math.min(1, Math.sqrt(MAX_BACKING_PIXELS / (wDev * hDev)));
  scale = Math.min(scale, MAX_BACKING_DIM / Math.max(wDev, hDev));
  const w = Math.max(1, Math.round(wDev * scale));
  const h = Math.max(1, Math.round(hDev * scale));
  if (w !== backingW || h !== backingH) { backingW = w; backingH = h; needsResize = true; markDirty(); }
}

const ro = new ResizeObserver((entries) => {
  const e = entries[0];
  if (e.devicePixelContentBoxSize) {
    onResize(e.devicePixelContentBoxSize[0].inlineSize,
             e.devicePixelContentBoxSize[0].blockSize);
  } else {
    // Safari/Firefox fallback: contentBoxSize is CSS px, multiply by DPR and round
    const dpr = window.devicePixelRatio || 1;
    const box = e.contentBoxSize?.[0];
    const cw = box ? box.inlineSize  : canvas.clientWidth;
    const ch = box ? box.blockSize   : canvas.clientHeight;
    onResize(Math.round(cw * dpr), Math.round(ch * dpr));
  }
});
try { ro.observe(canvas, { box: 'device-pixel-content-box' }); }
catch { ro.observe(canvas); }   // older engines reject the box option

// apply it inside the rAF callback, immediately before drawing:
function applyResize() {
  if (!needsResize) return;
  canvas.width = backingW; canvas.height = backingH;
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  needsResize = false;
}
```

Why `device-pixel-content-box`:

* MDN: it "returns an array containing the size in device pixels (physical pixels) of the
  observed element", and the recommended pattern is exactly
  `canvas.width = entry.devicePixelContentBoxSize[0].inlineSize`, called "after layout but
  before paint", giving "a one-to-one mapping of canvas pixels to physical device pixels".
  <https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/devicePixelContentBoxSize>
* WebGL2Fundamentals warns that the naive `clientWidth * devicePixelRatio` route "will not
  actually work" reliably "due to rounding inconsistencies across browsers when zoom levels
  are involved", and points at `devicePixelContentBoxSize` as the accurate answer.
  <https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html>
* MDN marks `devicePixelContentBoxSize` as "Limited availability, not Baseline", hence the
  fallback branch. Try/catch the `observe()` call: browsers that do not know the box name
  throw.

### 4.2 Always read the size back from the context

```js
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
```

The WebGL spec is explicit that you might not get what you asked for:

> "If the requested width or height cannot be satisfied, either when the drawing buffer is
> first created or when the width and height attributes of the HTMLCanvasElement or
> OffscreenCanvas are changed, a drawing buffer with smaller dimensions shall be created.
> The dimensions actually used are implementation dependent and there is no guarantee that
> a buffer with the same aspect ratio will be created. The actual drawing buffer size can be
> obtained from the drawingBufferWidth and drawingBufferHeight attributes."
> <https://registry.khronos.org/webgl/specs/latest/1.0/>

and, importantly for this section:

> "A WebGL implementation must not perform any automatic scaling of the size of the drawing
> buffer on high-definition displays."

So DPR handling is entirely your problem, and there is no hidden magic to fight.

### 4.3 A sane maximum backing store

Two ceilings, and you want the smaller:

* **Hardware:** `MAX_VIEWPORT_DIMS` and `MAX_RENDERBUFFER_SIZE`. Measured 8192x8192 on
  SwANGLE. Anything larger than `MAX_RENDERBUFFER_SIZE` in either axis is a hard failure.
* **Element:** browser canvas limits. Per the widely-used
  <https://github.com/jhildenbiddle/canvas-size> test matrix and
  <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas>: Chrome
  allows up to 32,767 px per side with a maximum area of 268,435,456 px; Firefox 32,767 px
  per side with an area of 472,907,776 px; Safari caps area at 16,777,216 px; **iOS caps at
  4,096 x 4,096**. (On my headless SwiftShader build I measured 32768x1 and 16384x16384 as
  allocatable, which is more permissive than the documented desktop limits and should not
  be relied on.)

* **Performance:** this is the binding constraint in practice. Your renderer is
  fill-rate-bound: a full-screen pass with an SDF lookup, per-pixel solar geometry, and
  city glow overdraw. Budget by *fragment count*, not by resolution.

**Recommendation: cap the backing store at 3840 x 2160 = 8.29 megapixels total, and at 8192
in either dimension, scaling proportionally beyond that.** That gives:

| display | CSS size | DPR | native device px | backing after clamp | effective DPR |
|---|---|---|---|---|---|
| 1080p    | 1920x1080 | 1 | 1920x1080 | 1920x1080 | 1.00 |
| 1080p    | 1920x1080 | 2 | 3840x2160 | 3840x2160 | 2.00 |
| 4K       | 3840x2160 | 1 | 3840x2160 | 3840x2160 | 1.00 |
| 4K "HiDPI" | 2560x1440 | 2 | 5120x2880 | 3840x2160 | 1.50 |
| 5K iMac  | 2560x1440 | 2 | 5120x2880 | 3840x2160 | 1.50 |
| phone    |  390x844  | 3 | 1170x2532 | 1170x2532 | 3.00 |

An effective DPR of 1.5 on a 5K panel is visually indistinguishable from 2.0 for a smooth
gradient map with SDF-antialiased edges, and it is 44% fewer fragments. Make the cap a
setting so a user on a fast GPU can raise it.

Do **not** just render at DPR 1 and let the browser upscale. Your coastline is an SDF edge
one pixel wide; upscaling it turns it to mush and is the single most visible way to make
the app look cheap.

---

## 5. Roughly 7000 city-light points with additive glow

### 5.1 Recommendation: instanced quads. Not `gl.POINTS`.

7000 instances x 6 vertices = 42,000 vertices, one `drawArraysInstanced` call. That is
nothing. `ANGLE_instanced_arrays` functionality is core in WebGL 2, so
`vertexAttribDivisor` / `drawArraysInstanced` are always available.

### 5.2 Why not `gl.POINTS`

Three reasons, all of which produce *visibly ugly* results rather than merely slow ones.

**(1) `gl_PointSize` limits are wildly implementation dependent.**
Measured `ALIASED_POINT_SIZE_RANGE = [1, 1023]` on SwANGLE. WebGL2Fundamentals reports the
spread across real hardware: "M1/M2 hardware limits point size to 64, while other devices
have minimums of 512, usually 1024, and many provide 2048", and notes some implementations
have "a maximum size limit of 1".
<https://webgl2fundamentals.org/webgl/lessons/webgl-cross-platform-issues.html>
A 64 px cap on Apple Silicon breaks a glow sprite at DPR 2. It also fails silently:
the point simply renders small, and you will not notice on your dev machine.

**(2) Point clipping is explicitly implementation-defined, and this is fatal for a pannable
map.** The WebGL spec says, verbatim:

> "**Wide point primitive clipping.** POINTS primitives may or may not be discarded if the
> vertex lies outside the clip volume, but within the near and far clip planes. Clipping of
> wide points works differently in GLES and GL, and this difference in behavior is
> prohibitive to work around in implementations.
> OpenGL ES 2.0.25 p46: If the primitive under consideration is a point, then clipping
> discards it if it lies outside the near or far clip plane; otherwise it is passed
> unchanged.
> OpenGL 3.2 Core p97: If the primitive under consideration is a point, then clipping passes
> it unchanged if it lies within the clip volume; otherwise, it is discarded."
> <https://registry.khronos.org/webgl/specs/latest/1.0/>

WebGL2Fundamentals restates the practical consequence: "on Macintosh systems clipping is
based on the point's center location, while on Windows and Linux systems, clipping is based
on the entire square rendering of the point."

I measured this: on SwANGLE (desktop-GL semantics), a 40 px point whose centre is at
NDC x = 1.2 (well outside the viewport) still rasterises inside the viewport.

```
point_centre_at_edge_visible:  true
point_centre_outside_visible:  true
point_centre_inside_visible:   true
```

On an ES-semantics driver that same point would vanish. So on some machines, city glows
will pop out of existence the instant the city centre crosses the screen edge while you
pan. There is no workaround short of expanding the viewport, which costs you fill rate
everywhere.

**(3) `gl_PointCoord` has its origin at the top left** (y grows downward), unlike everything
else in GL. Not fatal, but a classic source of "why is my sprite upside down".

### 5.3 The instanced-quad implementation

```js
// per-vertex: a unit quad, 6 verts, corners in [-1, 1]
const quad = new Float32Array([-1,-1,  1,-1,  1, 1,  -1,-1,  1, 1,  -1, 1]);
// per-instance: world x, world y, brightness
const inst = new Float32Array(3 * cityCount);

gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(0, 0);                       // per vertex

gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 12, 0);   // world xy
gl.vertexAttribDivisor(1, 1);                            // per instance
gl.enableVertexAttribArray(2);
gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 12, 8);   // brightness
gl.vertexAttribDivisor(2, 1);

// draw
gl.enable(gl.BLEND);
gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);  // additive RGB, leave alpha at 1
gl.depthMask(false);
for (const copy of visibleWorldCopies) {                 // -1, 0, +1
  gl.uniform1f(uCopyOffset, copy);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, cityCount);
}
gl.disable(gl.BLEND);
```

```glsl
// vertex
#version 300 es
layout(location = 0) in vec2 a_corner;      // [-1,1]^2
layout(location = 1) in vec2 a_world;       // world x in [0,1), y in [0,0.5]
layout(location = 2) in float a_bright;

uniform vec2  u_res;         // backing pixels
uniform vec2  u_centre;
uniform float u_scale;       // z * u_res.x
uniform float u_copyOffset;
uniform float u_glowPx;      // glow radius in BACKING pixels

out vec2  v_corner;
out float v_bright;

void main() {
    vec2 world = a_world + vec2(u_copyOffset, 0.0);
    vec2 px    = (world - u_centre) * u_scale + 0.5 * u_res;
    // radius grows slowly with zoom so cities separate as you zoom in but never explode
    float r = u_glowPx;
    px += a_corner * r;
    gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0);
    v_corner = a_corner;
    v_bright = a_bright;
}
```

```glsl
// fragment
#version 300 es
precision highp float;
in vec2  v_corner;
in float v_bright;
uniform vec3 u_lightColor;      // e.g. warm sodium, LINEAR light, not sRGB
uniform float u_nightMask;      // supplied by the twilight pass, 0 in daylight
out vec4 o_color;

void main() {
    float r2 = dot(v_corner, v_corner);
    if (r2 > 1.0) discard;                        // circular, not square
    // two-lobe falloff: a tight core plus a wide halo reads much better than one gaussian
    float core = exp(-r2 * 18.0);
    float halo = exp(-r2 *  2.2) * 0.28;
    float i    = (core + halo) * v_bright * u_nightMask;
    o_color = vec4(u_lightColor * i, 0.0);        // alpha 0: additive, do not touch dst alpha
}
```

Notes and pitfalls:

* `u_glowPx` should be in **backing pixels**, so multiply by your effective DPR. A glow that
  is 12 CSS px at DPR 1 must be 24 backing px at DPR 2 or the lights look tiny on a
  retina screen.
* Overdraw budget: 7000 instances at a 32 backing-px radius is `7000 * pi * 32^2 = 22.5 M`
  fragments, which is 2.7 full 4K screens. Acceptable, but not free. Cull instances outside
  the viewport on the CPU (a sorted-by-x index makes this trivial) and shrink `u_glowPx` at
  low zoom.
* `discard` in the fragment shader disables early-Z on many GPUs. At 7000 unoccluded
  additive sprites with depth writes off it does not matter, but if you ever add depth,
  clip with `smoothstep` and an alpha of zero rather than `discard`.
* Additive blending must operate on **linear light**, and your final sRGB encode must happen
  after it. See section 8.5. Adding sRGB-encoded values gives washed-out, chalky glows.
* Sorting is unnecessary: addition is commutative.

### 5.4 Baking into a texture

Worth doing as a **low-zoom optimisation only**, and it has a real flaw.

The flaw: a glow baked at world resolution has a fixed *world* radius. Zoom in 8x and each
city becomes an 8x-larger blurry blob instead of a crisp point with a halo. That is exactly
wrong: the physical thing you are depicting (a city's light dome) has a fixed angular size
on the map, but the *rendering* of it should keep a roughly constant apparent size so it
reads as a light source at every zoom.

If you do bake, bake at `z = 1` only, render the baked texture for `z < 1.5`, cross-fade
to instanced quads above that, and use the same `u_glowPx` in both so the transition is
invisible. Given how cheap the instanced path is, this is optimisation you almost certainly
do not need. **Recommendation: skip it.**

---

## 6. Crisp thin lines at any zoom

### 6.1 `gl.lineWidth()` is dead

Measured `ALIASED_LINE_WIDTH_RANGE = [1, 1]` on SwANGLE. WebGL2Fundamentals states flatly:
"Line width fixed at 1.0."
<https://webgl2fundamentals.org/webgl/lessons/webgl-cross-platform-issues.html>
Chrome and Firefox on desktop have supported only width 1 for years. Never call
`gl.lineWidth` with anything but 1. Not a candidate.

### 6.2 Instanced quad expansion (the standard technique)

The canonical write-up is Rye Terrell's, <https://wwwtyro.net/2019/11/18/instanced-lines.html>.
The instance geometry, verbatim:

```js
const segmentInstanceGeometry = [
  [0, -0.5],
  [1, -0.5],
  [1,  0.5],
  [0, -0.5],
  [1,  0.5],
  [0,  0.5]
];
```

"two triangles, six vertices, centered on the origin vertically, but shifted to the right
one unit horizontally". The expansion in the vertex shader, verbatim:

```glsl
vec2 xBasis = pointB - pointA;
vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
vec2 point = pointA + xBasis * position.x + yBasis * width * position.y;
gl_Position = projection * vec4(point, 0, 1);
```

and the attribute setup that makes consecutive polyline points into per-instance endpoints
by offsetting the same buffer by one vertex:

```js
pointA: { buffer: points, divisor: 1, offset: Float32Array.BYTES_PER_ELEMENT * 0,
          stride: Float32Array.BYTES_PER_ELEMENT * 4 },
pointB: { buffer: points, divisor: 1, offset: Float32Array.BYTES_PER_ELEMENT * 2,
          stride: Float32Array.BYTES_PER_ELEMENT * 4 }
```

That trick (one buffer, two attributes, offset by one point, divisor 1) means N points give
N-1 segment instances with no extra memory. Copy it.

**Do the expansion in screen space, not world space.** If `pointA`/`pointB` are world
coordinates and you scale by `width` before the projection, the line gets thicker as you
zoom in. You want a constant apparent thickness. So project first, expand second:

```glsl
#version 300 es
layout(location = 0) in vec2 a_pos;     // instance geometry, [0..1] x [-0.5..0.5]
layout(location = 1) in vec2 a_worldA;  // divisor 1
layout(location = 2) in vec2 a_worldB;  // divisor 1

uniform vec2  u_res;
uniform vec2  u_centre;
uniform float u_scale;
uniform float u_copyOffset;
uniform float u_widthPx;                // total width in BACKING pixels
uniform float u_featherPx;              // 1.0 is a good default

out float v_edge;                       // -1..1 across the line

vec2 toPx(vec2 w) { return (w + vec2(u_copyOffset, 0.0) - u_centre) * u_scale + 0.5 * u_res; }

void main() {
    vec2 A = toPx(a_worldA), B = toPx(a_worldB);
    vec2 xBasis = B - A;
    vec2 yBasis = normalize(vec2(-xBasis.y, xBasis.x));
    float halfW = 0.5 * u_widthPx + u_featherPx;      // pad for the feather
    vec2 px = A + xBasis * a_pos.x + yBasis * (2.0 * halfW) * a_pos.y;
    v_edge = a_pos.y * 2.0;                           // -1 at one edge, +1 at the other
    gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0);
}
```

```glsl
#version 300 es
precision highp float;
in float v_edge;
uniform float u_widthPx, u_featherPx;
uniform vec4  u_color;                                 // PREMULTIPLIED
out vec4 o_color;
void main() {
    float halfW = 0.5 * u_widthPx + u_featherPx;
    float dPx   = abs(v_edge) * halfW;                 // distance from the centreline, px
    float a     = 1.0 - smoothstep(0.5 * u_widthPx - u_featherPx,
                                   0.5 * u_widthPx + u_featherPx, dPx);
    o_color = u_color * a;
}
```

This is Mapbox's original scheme. Their write-up:
"When we calculate the length of the vector, we get the perpendicular distance of that pixel
from the original line segment, in the range of 0..1", opaque within `linewidth - feather`,
a gradient between `linewidth - feather` and `linewidth + feather`, zero beyond, and
"a feather value of 0.5 produces regular antialiasing that looks very similar to what Agg
produces".
<https://medium.com/mapbox/drawing-antialiased-lines-with-opengl-8766f34192dc>

Their vertex shader, for reference:

```glsl
attribute vec2 a_pos;
attribute vec2 a_normal;
uniform float u_linewidth;
uniform mat4 u_mv_matrix;
uniform mat4 u_p_matrix;

void main() {
  vec4 delta = vec4(a_normal * u_linewidth, 0, 0);
  vec4 pos = u_mv_matrix * vec4(a_pos, 0, 1);
  gl_Position = u_p_matrix * (pos + delta);
}
```

Note their variant extrudes before projection, which is why it needs the extra care; the
screen-space version above avoids the issue entirely.

### 6.3 Joins

Independent quads leave a wedge-shaped notch on the outside of every bend.

* **Round joins** (Terrell's, and the one to use): draw a second instanced pass of a
  circular triangle fan of radius `halfW` centred on every interior vertex. Perfect for any
  angle including doubling back, cheap, and it also gives you round caps for free. Cost: one
  extra draw call, `N` instances of ~16 triangles.
* **Miter joins:** compute the miter vector `m = normalize(n1 + n2)` and extend by
  `halfW / dot(m, n1)`, with a miter limit (reject and fall back to a bevel above about
  `1/dot < 4`) or acute angles produce a spike hundreds of pixels long. Terrell's article
  describes the miter variant as using "coefficient-based indexing with three basis vectors
  (p0, p1, p2) calculated from tangent and perpendicular directions".
* **For the graticule specifically, joins do not exist.** Meridians and parallels are
  disjoint polylines with no bends in world space. Skip joins entirely for that layer.
* **For timezone borders they do matter**, because those are dense, jagged polylines. Use
  round joins.

At the widths you will use (1 to 2 CSS px), the difference between round, miter and no join
at all is at the edge of perceptibility. Implement round joins because they cost twenty
lines of code, not because you will see them.

### 6.4 The overlay 2D canvas question

Measured relevant data:

* `ne_10m_time_zones.geojson`: 120 features, 143 rings, **155,007 vertices** (so about
  154,900 line segments).
* A 10-degree graticule is 36 meridians (181 points each at 1-degree steps) plus 17
  parallels (361 points each), about 12,650 points, 12,600 segments.
* Twilight contours (civil / nautical / astronomical, 6 curves) are marching-squares output
  over the whole map, so somewhere in the low thousands of segments, and they change every
  single frame while animating.

**Register is a solved problem, and it is not the reason to avoid an overlay.** Two canvas
elements stacked with CSS are separate elements, but the browser composites one frame per
turn of the "update the rendering" steps. If you resize both to the same backing size and
draw both inside the *same* `requestAnimationFrame` callback, they are guaranteed to reach
the compositor together. The failure modes are all avoidable:

* Drawing one in `rAF` and the other in a `pointermove` handler. Do not do that; queue a
  dirty flag from input and draw everything in `rAF`.
* `getContext('2d', { desynchronized: true })`. The HTML spec's own description is that the
  UA "may optimize rendering by desynchronizing the canvas paint cycle from the event loop,
  which might introduce visible tearing artifacts"
  (<https://github.com/whatwg/html/issues/5466>). Never set it here.
* CSS-transforming the overlay to "cheaply" follow a pan. That both blurs the strokes and
  breaks register with the WebGL layer, which is *not* being transformed. Redraw instead.

**The real reasons to avoid a full 2D overlay for vector work:**

1. **Cost.** Stroking ~155,000 line segments in Canvas 2D at 3840x2160 every frame while
   the user pans is not going to hold 60 fps. **UNVERIFIED**: I did not benchmark it in a
   browser. But it is CPU path rasterisation over 8.3 megapixels with a fresh
   `Path2D` traversal each frame, and it is 155k segments. Budget for it being 10x to 50x
   the cost of the GPU path.
2. **No blending with the map.** The twilight contour lines want to be *screen* or
   *additive* blended against the sky gradient beneath them so they glow rather than sit on
   top as flat strokes. A separate compositor layer only gives you `source-over` against
   the WebGL result, via `mix-blend-mode` at best.
3. **Colour space.** Your WebGL pass will be working in linear light and encoding to sRGB at
   the end. Canvas 2D works in sRGB code values. Getting a stroke to match a colour computed
   in the shader means duplicating the transfer function on the CPU. Doable, annoying, and
   easy to get subtly wrong.

**The reason to keep an overlay canvas anyway: text.** Rendering city names, timezone
labels, and DST-correct local clocks in WebGL means an SDF font atlas, a text layout engine,
and a shaping pass. That is a bigger project than the rest of this document. Canvas 2D does
it in one `fillText` call per label, with real font hinting, real subpixel positioning, and
free `measureText` for collision avoidance.

**Recommendation: hybrid, split by whether the layer needs to blend or animate.**

| layer | renderer | why |
|---|---|---|
| land/ocean/twilight | WebGL full-screen pass | per-pixel physics |
| coast glow, shelf | WebGL (from the SDF) | needs additive blending |
| graticule | WebGL instanced quads | 12.6k segments, needs to sit under the contours |
| timezone borders | WebGL instanced quads | 155k segments, static geometry, upload once |
| twilight contours | WebGL instanced quads | changes every frame, wants additive blend |
| city light glows | WebGL instanced quads | additive |
| **all text** | **2D overlay canvas** | font rendering, layout, collision |
| subsolar marker, UI chrome | 2D overlay canvas | trivial, and it is already there |

The text overlay only needs to redraw when the view or the clock changes, which for a
label layer is fine even at 4K because there are only a few hundred glyph runs.

Sizing the overlay: use exactly the same `backingW`/`backingH` as the WebGL canvas, and
scale the 2D context once per resize so you can draw in CSS pixels:

```js
overlayCtx.setTransform(backingW / canvas.clientWidth, 0, 0,
                        backingH / canvas.clientHeight, 0, 0);
```

---

## 7. A robust render loop

### 7.1 Separate the three clocks

There are three, and conflating any two is the source of every drift bug:

1. **Wall clock**: `Date.now()` / `performance.now()`. Real, monotonic-ish, never lies.
2. **Frame clock**: the `DOMHighResTimeStamp` argument to `requestAnimationFrame`. The HTML
   Standard defines "run the animation frame callbacks for a target object target with a
   timestamp now ... For each handle in callbackHandles ... Invoke callback with << now >>",
   so every callback in one frame gets the *same* `now`
   (<https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html>). Use it for
   frame deltas, never for simulation state.
3. **Simulation clock**: the instant of Earth time being displayed. **Keep this as an
   integer count of milliseconds since the Unix epoch, in a plain `Number`.** Integers up
   to 2^53 are exact in a double, and the epoch is only ~1.8e12, so it never loses
   precision. Never store it as "seconds as a float" and never accumulate `+= dt * rate`
   with a float `dt`.

```ts
type Mode =
  | { kind: 'live' }                                      // follow the wall clock
  | { kind: 'paused'; epochMs: number }
  | { kind: 'playing'; epochMs: number; msPerSecond: number };  // e.g. 3_600_000 = 1 h/s

function simEpochMs(mode: Mode, wallNowMs: number, anchorWallMs: number): number {
  switch (mode.kind) {
    case 'live':    return Date.now();
    case 'paused':  return mode.epochMs;
    case 'playing': return mode.epochMs + Math.round((wallNowMs - anchorWallMs) * mode.msPerSecond / 1000);
  }
}
```

In `playing` mode, `epochMs` and `anchorWallMs` are both set once at the moment play starts
and are never touched again until the user scrubs or the rate changes. The displayed time is
therefore a **closed-form function of elapsed wall time**. It cannot drift, cannot
accumulate float error, and produces the same result whether you rendered 1 frame or 10,000
frames in between. This is the whole trick.

### 7.2 Fixed step versus variable step: neither, for this app

Gaffer on Games' accumulator is the correct answer when you have **stateful numerical
integration** whose result depends on the step size
(<https://gafferongames.com/post/fix_your_timestep/>):

```cpp
double t = 0.0;
double dt = 0.01;
double currentTime = hires_time_in_seconds();
double accumulator = 0.0;
State previous, current;

while ( !quit ) {
    double newTime = time();
    double frameTime = newTime - currentTime;
    if ( frameTime > 0.25 ) frameTime = 0.25;
    currentTime = newTime;
    accumulator += frameTime;
    while ( accumulator >= dt ) {
        previousState = currentState;
        integrate( currentState, t, dt );
        t += dt;
        accumulator -= dt;
    }
    const double alpha = accumulator / dt;
    State state = currentState * alpha + previousState * ( 1.0 - alpha );
    render( state );
}
```

**You have no such state.** Solar position is an analytic function of an instant. Timezone
offsets are a lookup. Twilight bands are a function of solar elevation. Everything the
heliograph draws is a pure function `render(simEpochMs, view)`. So there is nothing to
integrate, no step-size dependence, and a fixed timestep buys you nothing while costing you
complexity.

The two pieces of state you *do* have, inertia and camera easing, should both be closed-form
(section 3.6, following MapLibre) for exactly the same reason. If you take that discipline
everywhere, the answer to "fixed or variable step?" is "the question does not arise", which
is a strictly better place to be.

Keep the `0.25` clamp idea anyway, as a guard for a different purpose: see 7.4.

### 7.3 Only redraw when dirty

```ts
let dirty = true;
let rafId = 0;

export function markDirty() {
  dirty = true;
  if (!rafId) rafId = requestAnimationFrame(frame);
}

function frame(frameNowMs: number) {
  rafId = 0;
  applyResize();                       // section 4

  const sim = simEpochMs(mode, performance.now(), anchorWallMs);
  const animating = mode.kind === 'playing' || inertia.active() || camera.easing();

  if (dirty || animating || sim !== lastRenderedSim) {
    dirty = false;
    lastRenderedSim = sim;
    render(sim, view);
  }
  if (animating || dirty) rafId = requestAnimationFrame(frame);
}
```

Points that matter:

* When nothing is animating, **stop scheduling frames entirely**. Do not run a permanent
  `rAF` loop that early-returns; that still wakes the compositor every 16 ms and shows up in
  battery measurements. `markDirty()` restarts it.
* In `live` mode, schedule a `setTimeout` for the next second boundary rather than running
  `rAF` continuously: the subsolar point moves 15 arcseconds per second of time, which is
  invisible, and the clock display only needs to update once a second.
* `dirty` must be set by: pointer input, wheel, keyboard, resize, mode change, scrub,
  settings change, `webglcontextrestored`, and `visibilitychange` to visible.
* MDN notes that with `rAF` an explicit `gl.flush()` "isn't really needed... Because RAF is
  directly followed by the frame boundary". If you ever render outside `rAF` (a one-shot
  offscreen bake, for instance), call `gl.flush()`.
  <https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices>

### 7.4 Background tabs

MDN, Page Visibility API: "Most browsers stop sending `requestAnimationFrame()` callbacks to
background tabs or hidden `<iframe>`s", and `setTimeout` is throttled with "throttling
begins after 30 seconds (10 seconds in Chrome)", a budget from -150 ms to +50 ms in Firefox
regenerating "at 10ms per second".
<https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API>

The consequence for a naive `+= dt` loop is severe: you background the tab for an hour, come
back, and the first frame delivers a `dt` of 3,600,000 ms. With a closed-form sim clock the
consequence is exactly zero: `simEpochMs` is computed from the current wall time, so the
display jumps forward to where it should be and carries on. That is almost always the
behaviour you want for a heliograph.

```ts
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    // do NOT freeze the sim clock: it is derived, so it stays correct by construction
  } else {
    markDirty();          // wakes the loop; the next frame lands at the right sim time
  }
});
```

If you would rather the animation **pause** while hidden (so a user who backgrounds a
year-long animation comes back to where they left it, not to next August), convert to
paused on hide and re-anchor on show:

```ts
if (document.visibilityState === 'hidden' && mode.kind === 'playing') {
  mode = { kind: 'paused', epochMs: simEpochMs(mode, performance.now(), anchorWallMs) };
  wasPlaying = savedRate;
} else if (document.visibilityState === 'visible' && wasPlaying) {
  mode = { kind: 'playing', epochMs: currentEpoch, msPerSecond: wasPlaying };
  anchorWallMs = performance.now();     // re-anchor: this is what prevents the jump
  wasPlaying = 0;
  markDirty();
}
```

The `anchorWallMs = performance.now()` re-anchor is the whole point. Make it a rule: any
time you change mode, scrub, or change rate, set `epochMs` to the current sim time and
`anchorWallMs` to the current wall time, in that order.

Also guard against a hidden-tab burst on the *first* visible frame if you ever do keep a
delta-based path: clamp the delta at 250 ms, per Gaffer's `if (frameTime > 0.25)`.

### 7.5 Do not use `Date.now()` for frame deltas

`Date.now()` is subject to NTP corrections and manual clock changes and can go backwards.
Use `performance.now()` for all elapsed-time maths and `Date.now()` only to answer
"what instant is it in the real world" in `live` mode.

---

## 8. WebGL2 pitfalls that produce visibly ugly results

### 8.1 Precision

Declared precision is honoured on mobile and ignored on desktop. WebGL2Fundamentals:
"Desktop uses `highp` regardless; mobile respects `mediump`/`lowp` declarations."
<https://webgl2fundamentals.org/webgl/lessons/webgl-cross-platform-issues.html>
So the bug is invisible on your machine and catastrophic on a phone.

ESSL 300 minimum requirements, from MDN
(<https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices>):

| type | think | range | min above zero | precision |
|---|---|---|---|---|
| `highp`   | IEEE float32 | (-2^126, 2^127) | 2^-126 | 2^-24 relative |
| `mediump` | IEEE float16 | (-2^14, 2^14)   | 2^-14  | 2^-10 relative |
| `lowp`    | 10-bit signed fixed | (-2, 2)  | 2^-8   | 2^-8 absolute |

I confirmed those two rows exactly on SwANGLE: `HIGH_FLOAT` reports
`{rangeMin: 127, rangeMax: 127, precision: 23}` and `MEDIUM_FLOAT` reports
`{rangeMin: 15, rangeMax: 15, precision: 10}`.

For this app that means:

* `mediump` maxes out at **65,504**. A Julian Day number (~2,460,000) is `+inf` in
  `mediump`. So is a Unix epoch in seconds (1.8e9) and certainly in milliseconds. Anything
  carrying absolute time must be `highp`, and preferably should be reduced on the CPU to a
  small number (hour angle in radians, days since J2000 as a fraction) before it ever
  reaches a shader.
* A longitude of 179.99 in `mediump` (float16) resolves to about 0.06 degrees, which is
  **7 km of error at the equator**. Every coordinate in this app is `highp`.
* Declare it explicitly. ESSL requires an explicit float precision in fragment shaders (MDN
  lists implicit fragment defaults for `int`, `sampler2D` and `samplerCube` but not for
  `float`). If you rely on the default you get a compile error on some drivers and
  `mediump` on others.
* MDN also warns: "If you have a float texture, iOS requires that you use
  `highp sampler2D foo;`, or it will give you `lowp` texture samples." Your SDF is an
  `R16F` texture. Declare `uniform highp sampler2D u_sdf;`.

Boilerplate for the top of every fragment shader:

```glsl
#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
```

(In WebGL 2 `highp` in fragment shaders is mandatory, so the WebGL 1 era
`#ifdef GL_FRAGMENT_PRECISION_HIGH` dance is not needed. Keep it only if you also ship a
WebGL 1 fallback.)

### 8.2 Texture wrap modes at the seam

Covered in 1.2. Restating as a checklist because this is the number one source of "there is
a line down the middle of my map":

* `TEXTURE_WRAP_S = REPEAT`, `TEXTURE_WRAP_T = CLAMP_TO_EDGE`, always, for every
  equirectangular texture.
* Never `fract()` a texture coordinate that will be sampled with mipmapping, or you get a
  one-fragment-wide stripe of the lowest mip. Use `textureGrad` with derivatives from the
  unwrapped coordinate if you must.
* Never `fract()` a value you then pass to `fwidth()`, for the same reason.
* The same applies to any *derived* quantity: `fwidth(lon)` at the seam explodes if `lon`
  was computed with a wrap. Compute derivatives from the continuous world x, then convert.
* If you build a texture atlas or pack multiple maps into one texture, `REPEAT` no longer
  saves you; you must duplicate a border column manually.

### 8.3 Premultiplied alpha

The default context attribute is `premultipliedAlpha: true`, and the spec says the `alpha`,
`premultipliedAlpha` and `preserveDrawingBuffer` attributes "must be obeyed by the WebGL
implementation" (<https://registry.khronos.org/webgl/specs/latest/1.0/>).

Consequences:

* Whatever your fragment shader writes to the default framebuffer is interpreted as
  **premultiplied**. If you write `vec4(1.0, 1.0, 1.0, 0.5)` you have written an invalid
  colour (rgb > alpha) and the compositor will produce something unpredictable and usually
  too bright.
* **Simplest correct policy: make the canvas fully opaque. Write `alpha = 1.0` in the base
  pass, and use `blendFuncSeparate(srcRGB, dstRGB, gl.ZERO, gl.ONE)` in every overlay pass
  so nothing can ever reduce the destination alpha.** Then premultiplication is a no-op and
  you cannot get it wrong.
* Do **not** reach for `alpha: false`. MDN: "Avoid alpha:false, which can be expensive...
  On some platforms, this comes at a significant performance cost... Most applications can
  be structured to produce 1.0 for the alpha channel instead."
* For texture uploads, `UNPACK_PREMULTIPLY_ALPHA_WEBGL` defaults to `false`. If you upload
  a PNG sprite with soft edges and then blend with `(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)`, you
  get dark fringes. Either set `gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)`
  and blend with `(ONE, ONE_MINUS_SRC_ALPHA)`, or premultiply in the shader. Be consistent.
* For **data** textures (the SDF, a mask) set `UNPACK_PREMULTIPLY_ALPHA_WEBGL = false` and
  `UNPACK_COLORSPACE_CONVERSION_WEBGL = gl.NONE` explicitly. The defaults will silently
  corrupt your numbers otherwise.

### 8.4 Non-power-of-two textures

A non-issue in WebGL 2, and worth saying so because the WebGL 1 folklore is everywhere.
Spec: "unlike the WebGL 1.0 API, there are no special restrictions on non power of 2
textures. All mipmapping and all wrapping modes are supported for non-power-of-two images."
<https://registry.khronos.org/webgl/specs/latest/2.0/>
I verified a 300x150 texture with `REPEAT` + `generateMipmap` on SwANGLE: no error.

Still choose power-of-two dimensions for the big equirectangular maps (8192x4096), because
the mip chain then halves exactly with no rounding, which keeps the seam blend exact at
every level.

### 8.5 sRGB and colour space (the one that decides whether it looks beautiful)

This is the section to get right. A "physically-derived twilight gradient" computed in the
wrong space will look muddy and no amount of colour tweaking will fix it.

**The rule:** the default WebGL drawing buffer is **sRGB-encoded**. `drawingBufferColorSpace`
defaults to `"srgb"`
(<https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawingBufferColorSpace>).
Whatever number your fragment shader writes to `gl_FragColor` / your `out vec4` is treated
as an sRGB code value and sent to the display as-is. There is **no way to request an sRGB
default framebuffer** in WebGL 2, so no automatic encode happens for you.

Therefore:

1. **Do all physics and all blending in linear light.**
2. **Encode to sRGB exactly once, in the final fragment shader, immediately before you
   write the output.**
3. **Decode any sRGB-authored input (colour swatches, PNG sprites) to linear on the way in.**

The exact transfer functions, from CSS Color Module Level 4 section 19, "Sample code for
Color Conversions", <https://www.w3.org/TR/css-color-4/>:

```js
function lin_sRGB(RGB) {
	return RGB.map(function (val) {
		let sign = val < 0? -1 : 1;
		let abs = Math.abs(val);
		if (abs <= 0.04045) { return val / 12.92; }
		return sign * (Math.pow((abs + 0.055) / 1.055, 2.4));
	});
}
function gam_sRGB(RGB) {
	return RGB.map(function (val) {
		let sign = val < 0? -1 : 1;
		let abs = Math.abs(val);
		if (abs > 0.0031308) { return sign * (1.055 * Math.pow(abs, 1/2.4) - 0.055); }
		return 12.92 * val;
	});
}
```

GLSL, branchless (the `mix` form avoids divergence and is what you want in the hot path):

```glsl
vec3 linearToSrgb(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(12.92 * c,
               1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
               step(vec3(0.0031308), c));
}
vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92,
               pow((c + 0.055) / 1.055, vec3(2.4)),
               step(vec3(0.04045), c));
}
```

Do **not** substitute `pow(c, 2.2)` / `pow(c, 1.0/2.2)`. The error is largest in the deep
shadows, which is precisely where a twilight gradient lives. At a code value of 0.05 the
exact sRGB inverse gives `((0.05 + 0.055) / 1.055)^2.4 = 0.003936`, while `pow(0.05, 2.2)`
gives `0.001374`: a factor of 2.9 too dark. Your civil twilight band will be the wrong
brightness, and no amount of colour tweaking downstream will make it right.

**Textures.** For any texture whose contents were authored in sRGB (a colour LUT, a sprite),
use the `SRGB8_ALPHA8` internal format and the sampler decodes to linear for free, including
correct decoding *before* bilinear filtering, which manual decode in the shader cannot do:

```js
gl.texStorage2D(gl.TEXTURE_2D, levels, gl.SRGB8_ALPHA8, w, h);   // verified: no error
gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
```

For **data** textures (SDF, land mask, elevation) use `R8` / `R16F` / `RG8`, never an sRGB
format, and turn off colour management on decode (section 2.4).

**Banding.** A full-screen smooth gradient at 8 bits per channel bands visibly, and a
twilight terminator is the single worst case for it: a very low-contrast gradient stretched
across 2000 pixels. This is the highest-value-per-line-of-code change in the whole
document. Add ordered dither immediately after the sRGB encode:

```glsl
// Jorge Jimenez's interleaved gradient noise (Call of Duty: Advanced Warfare, 2014)
// via https://blog.frost.kiwi/GLSL-noise-and-radial-gradient/
float gradientNoise(in vec2 uv) {
    return fract(52.9829189 * fract(dot(uv, vec2(0.06711056, 0.00583715))));
}

// at the very end of the fragment shader:
vec3 encoded = linearToSrgb(colorLinear);
encoded += (1.0 / 255.0) * gradientNoise(gl_FragCoord.xy) - (0.5 / 255.0);
o_color = vec4(encoded, 1.0);
```

The `- (0.5 / 255.0)` keeps the mean brightness unchanged. Amplitude is exactly one 8-bit
step; more than that is visible as noise, less does not break the bands. Dither **after**
the sRGB encode, because the quantisation you are hiding happens in the encoded space.

**Wide gamut.** You can opt into P3 with `gl.drawingBufferColorSpace = 'display-p3'`;
"along with the default (srgb), the display-p3 color space can be used"
(<https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawingBufferColorSpace>),
supported by default in Chrome 104+. Tempting for a sunset gradient. But it changes the
meaning of every colour constant in your code and it will not match the 2D overlay canvas
unless you also set that canvas's colour space. Recommendation: ship sRGB, revisit later,
and if you do revisit it, do the whole pipeline or none of it.

### 8.6 Losing the context

The WebGL spec's own words on what happens:

> "Set context's webgl context lost flag. Set the invalidated flag of each WebGLObject
> instance created by this context. Disable all extensions except 'WEBGL_lose_context'.
> Queue a task to perform the following steps: Fire a WebGL context event named
> 'webglcontextlost' at canvas... If the event's canceled flag is not set, abort these
> steps."

and:

> "The following code prevents the default behavior of the webglcontextlost event and
> enables the webglcontextrestored event to be delivered:
> `canvas.addEventListener("webglcontextlost", function(e) { e.preventDefault(); }, false);`"

<https://registry.khronos.org/webgl/specs/latest/1.0/>

So: **if you do not call `preventDefault()`, you will never get a restore event.** That is
the whole game. Everything else follows.

```ts
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();                 // MANDATORY, or no restore
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  disposeAllGlHandles();              // they are invalid; drop the references
  showOverlay('Restoring graphics...');
}, false);

canvas.addEventListener('webglcontextrestored', () => {
  initGl();                           // recreate EVERYTHING: programs, buffers, textures, VAOs, FBOs
  hideOverlay();
  markDirty();
}, false);
```

Practical structure that makes this cheap: keep every GL object behind a single
`createResources(gl)` function that returns a plain object, and every CPU-side source of
truth (the earcut arrays, the SDF `Uint16Array`, the city list) in memory outside it. Then
restore is one call. If your only path to a texture is "fetch a 17 MB file", a restore takes
seconds.

Test it deliberately:

```js
const lose = gl.getExtension('WEBGL_lose_context');
lose.loseContext();
setTimeout(() => lose.restoreContext(), 1000);
```

Also handle the failure to get a context at all. Chromium's own docs say plainly:
"Chromium and other browsers do not guarantee WebGL availability. Please test and handle
WebGL context creation failure and fall back to other web APIs such as Canvas2D or an
appropriate message to the user."
<https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md>

MDN's other context-lifetime advice: "Consider eagerly losing WebGL contexts via the
`WEBGL_lose_context` extension when you're definitely done with them", but "this is not
necessary to do when navigating away from a page".

### 8.7 Miscellaneous, all from MDN WebGL best practices

* **Never call `getError()`, `getParameter()`, `getShaderParameter()`,
  `checkFramebufferStatus()` or `readPixels()` in the render loop.** Each is a
  "possible flush + round-trip" to the GPU process. Check shader compile status once at
  startup. In production, check nothing: "The only errors a well-formed page generates are
  `OUT_OF_MEMORY` and `CONTEXT_LOST`."
* **Upload textures before you start drawing, not between draws.** "Most texture uploads
  from DOM elements will incur a processing pass that will temporarily switch GL Programs
  internally, causing a pipeline flush." MDN gives the exact anti-pattern and the fix.
* **`powerPreference: 'high-performance'`** at context creation on a dual-GPU laptop, or you
  render the whole map on the integrated GPU. **UNVERIFIED** whether this materially matters
  for this workload; it costs nothing to set.
* **Attribute locations are not guaranteed.** Use
  `layout(location = N)` in ESSL 300 (which you can, unlike ESSL 100) or
  `bindAttribLocation` before linking. Do not assume they come out in declaration order.
* **`pow(x, y)` is undefined for `x < 0`.** Your sRGB encode clamps first for exactly this
  reason.

---

## 9. Testing WebGL headlessly

### 9.1 Does Playwright's bundled Chromium give real WebGL2? Yes. Measured.

Playwright 1.62.1, bundled `chromium-1234`, `chromium.launch({ headless: true })`, **no
extra args**, Windows 11:

```
webgl2:   true
renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
version:  WebGL 2.0 (OpenGL ES 3.0 Chromium)
```

Full parameter dump is in section 0. It is a complete, conformant WebGL 2: 29 extensions,
`EXT_color_buffer_float`, `OES_texture_float_linear`, `EXT_texture_filter_anisotropic` up
to 16x, `MAX_SAMPLES = 4`, and every ESSL 300 feature I probed (`fwidth`, `textureGrad`,
`textureLod`, `texelFetch`, `roundEven`) compiles.

I also ran it with `--use-gl=angle --use-angle=swiftshader`, with
`--enable-unsafe-swiftshader`, and with both. **All four configurations produced the same
renderer string and the same capabilities.** The only difference was one extension
(`EXT_disjoint_timer_query_webgl2` appeared with the explicit `--use-angle=swiftshader`,
giving 30 rather than 29 extensions).

### 9.2 What flags to set anyway, and why

Even though the default works today, set them:

```ts
// playwright.config.ts
export default defineConfig({
  use: {
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',    // force software: identical pixels on every machine
        '--enable-unsafe-swiftshader', // future-proofs against the fallback removal
      ],
    },
    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 720 },
  },
});
```

Reasons:

1. **Determinism.** Without the flags, a developer with a discrete GPU renders through their
   real driver and CI renders through SwiftShader. Rasterisation rules, filtering, and
   floating-point rounding all differ, so their baselines will never match CI's. Forcing
   SwiftShader everywhere makes visual baselines portable. The Chromium docs give the exact
   flag pair: "With SwANGLE, the switches for software GL are:
   `--use-gl=angle --use-angle=swiftshader`."
   <https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md>
2. **The fallback is being removed.** Same doc: "Allowing automatic fallback to WebGL backed
   by SwiftShader has been deprecated and WebGL context creation will soon fail instead of
   falling back to SwiftShader... To opt-in to lower security guarantees and allow
   SwiftShader for WebGL, run the chrome executable with the `--enable-unsafe-swiftshader`
   command-line switch." The deprecation began in Chrome 130. My probe still worked without
   it on `chromium-1234`, so the removal has not landed in Playwright's build yet. Set the
   flag so it keeps working when it does.
3. **Not `--use-angle=gl`.** That is the flag for real GPU acceleration in headless (the
   createIT article recommends it for that reason,
   <https://www.createit.com/blog/headless-chrome-testing-webgl-using-playwright/>) which is
   the *opposite* of what you want for pixel-stable baselines. Use it only for a manual
   performance run.
4. **SwiftShader is not available on macOS-arm64.** If any contributor develops on an M-series
   Mac, the forced-software flags will fail there and they will need a separate project in
   the config. **UNVERIFIED** on my machine; reported in
   <https://github.com/microsoft/playwright/issues/28216>.

### 9.3 The capability that will bite you

`MAX_TEXTURE_SIZE` and `MAX_RENDERBUFFER_SIZE` are **8192** on SwANGLE, and
`MAX_VIEWPORT_DIMS` is `[8192, 8192]`. Your desktop GPU almost certainly reports 16384.

* An 8192x4096 SDF texture fits exactly. Good.
* A 16384x8192 SDF texture works on your machine and **fails in CI**.
* A 4K backing store (3840x2160) is fine, but if you ever test at 8K, the viewport clamp
  bites.

Write a unit test that asserts your largest texture is `<= 8192` in both dimensions, so the
constraint is documented in code rather than discovered by a red CI run.

### 9.4 Stable screenshots of a canvas

Measured: three consecutive `locator.screenshot()` calls on a WebGL2 canvas produced
**byte-identical PNGs** in all four combinations of `preserveDrawingBuffer` x
`deviceScaleFactor`:

```
preserveDrawingBuffer=false dsf=1:  d0bfbcf031b51bf9 x3
preserveDrawingBuffer=false dsf=2:  b966b06b8863eb79 x3
preserveDrawingBuffer=true  dsf=1:  d0bfbcf031b51bf9 x3
preserveDrawingBuffer=true  dsf=2:  b966b06b8863eb79 x3
```

So **you do not need `preserveDrawingBuffer: true`** for Playwright screenshots. Playwright
captures through the compositor, which sees the presented frame. (Keep
`preserveDrawingBuffer: false`: setting it true forces the implementation to keep the buffer
around across composites, which costs memory and bandwidth.)

`toHaveScreenshot()` also has its own stabilisation built in: "This method took a bunch of
screenshots until two consecutive screenshots matched, and saved the last screenshot to file
system." <https://playwright.dev/docs/test-snapshots>

Its options and defaults, from <https://playwright.dev/docs/api/class-pageassertions>:

| option | default |
|---|---|
| `animations` | `"disabled"` |
| `caret` | `"hide"` |
| `fullPage` | `false` |
| `maskColor` | `#FF00FF` |
| `maxDiffPixelRatio` | unset |
| `maxDiffPixels` | unset |
| `omitBackground` | `false` |
| `scale` | `"css"` |
| `threshold` | `0.2` |

Note `scale: "css"` is the default: screenshots are downscaled to CSS pixels. For a
DPR-sensitive renderer that hides exactly the class of bug you care about. Set
`scale: 'device'` for the canvas assertions.

**The test recipe:**

```ts
// tests/visual.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // 1. freeze the simulation clock BEFORE any app script runs
  await page.addInitScript(() => {
    (window as any).__HELIOGRAPH_TEST__ = {
      fixedEpochMs: Date.UTC(2026, 2, 20, 12, 0, 0),   // an equinox noon: nice terminator
      disableInertia: true,
      disableDither: true,          // dither is per-pixel noise; it is deterministic, but
                                    // disabling it makes diffs readable when they do fail
    };
  });
});

test('equinox noon terminator', async ({ page }) => {
  await page.goto('/');
  // 2. wait for an explicit application signal, never a fixed sleep
  await page.waitForFunction(() => (window as any).__heliograph?.framesRendered >= 2);
  // 3. screenshot the canvas element, at device scale
  await expect(page.locator('#map')).toHaveScreenshot('equinox-noon.png', {
    scale: 'device',
    animations: 'disabled',
    maxDiffPixelRatio: 0.001,   // ~8k pixels of a 1280x720 shot
    threshold: 0.15,
  });
});
```

The pieces that matter:

* **`addInitScript`, not `evaluate`.** It runs before any page script, so the app never
  renders a single frame at the real wall clock.
* **A frame counter, not a sleep.** Expose `window.__heliograph = { framesRendered }` from
  the render loop and `waitForFunction` on it. `waitFor(5000)` (as the createIT article
  suggests) is flaky and slow. Wait for `>= 2` so you know a full resize-then-draw cycle has
  completed.
* **Disable inertia and any easing** in test mode. A closed-form camera ease is deterministic
  in *sim* time but its state depends on how many frames elapsed, which depends on machine
  speed.
* **Screenshot the canvas locator, not the page.** Removes any scrollbar, font, and
  layout noise from the diff.
* **`maxDiffPixelRatio`, not `maxDiffPixels`.** Ratio survives a viewport change; an absolute
  count does not.
* **Keep the dither on for one test.** It is a deterministic function of `gl_FragCoord`, so
  it is stable, and a test that catches "someone removed the dither" is worth having.
* **Commit baselines per platform.** Playwright names snapshots
  `{testName}-{browser}-{platform}.png`, so a Windows dev and a Linux CI keep separate
  baselines. With SwiftShader forced they *should* match, but they are stored separately
  either way, so generate CI's baselines in CI (or in the same container image).

Also useful: assert the renderer string in a smoke test, so a CI image change that silently
drops SwiftShader fails loudly rather than producing a black canvas and a confusing diff.

```ts
test('webgl2 is available and software-rendered', async ({ page }) => {
  await page.goto('/');
  const info = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')!;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')!;
    return {
      renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string,
      maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    };
  });
  expect(info.renderer).toContain('SwiftShader');
  expect(info.maxTex).toBeGreaterThanOrEqual(8192);
});
```

### 9.5 Unit-testing shader-adjacent logic in Vitest

Anything that is pure maths (the view transform, `screenToWorld` / `worldToScreen`
round-trips, `clampY`, the inertia easing, the sim clock, the sRGB transfer functions)
should be plain TypeScript with no GL dependency, and tested in Vitest with no browser at
all. Property tests are cheap here: for a thousand random `(view, px, py)` triples, assert
`worldToScreen(view, screenToWorld(view, px, py))` returns `(px, py)` to within 1e-9.

For the SDF, test the build step in Node: rasterise a known shape (a 100 px circle), run the
EDT, and assert the distance at a handful of sample points matches the analytic answer to
within half a texel. That catches wrap and sign bugs long before they reach a shader.

---

## Appendix A: complete source list

Primary specifications and standards:

* WebGL 1.0 Specification: <https://registry.khronos.org/webgl/specs/latest/1.0/>
  (drawing buffer sizing, wide point primitive clipping, context loss steps, premultiplied
  alpha, `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, NaN line width). Fetched as raw HTML from
  <https://raw.githubusercontent.com/KhronosGroup/WebGL/main/specs/latest/1.0/index.html>.
* WebGL 2.0 Specification: <https://registry.khronos.org/webgl/specs/latest/2.0/>
  (non-power-of-two textures, `antialias` obeyed, extensions made core, compressed sRGB
  formats). Same raw-HTML route for the 2.0 path.
* HTML Standard, animation frame callbacks:
  <https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html>
* CSS Color Module Level 4, section 19 sample code (`lin_sRGB`, `gam_sRGB`):
  <https://www.w3.org/TR/css-color-4/>
* Chromium, Using Chromium with SwiftShader:
  <https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md>

MDN:

* WebGL best practices: <https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices>
* `ResizeObserverEntry.devicePixelContentBoxSize`: <https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/devicePixelContentBoxSize>
* Page Visibility API: <https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API>
* `Element.setPointerCapture`: <https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture>
* `createImageBitmap` options: <https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap>
* `OffscreenCanvas`: <https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas>
* `drawingBufferColorSpace`: <https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawingBufferColorSpace>
* `webglcontextlost` event: <https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event>
* `renderbufferStorageMultisample`: <https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/renderbufferStorageMultisample>
* `imageSmoothingQuality`: <https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingQuality>
* `<canvas>` element (size limits): <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas>
* `EXT_texture_filter_anisotropic`: <https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_filter_anisotropic>

Papers and canonical write-ups:

* Felzenszwalb and Huttenlocher, "Distance Transforms of Sampled Functions":
  <https://cs.brown.edu/people/pfelzens/papers/dt-final.pdf>
* Meijster, Roerdink and Hesselink, "A General Algorithm for Computing Distance Transforms
  in Linear Time": <https://fab.cba.mit.edu/classes/S62.12/docs/Meijster_distance.pdf>
  and <https://link.springer.com/chapter/10.1007/0-306-47025-X_36>
* Rong and Tan, "Jump flooding in GPU with applications to Voronoi diagram and distance
  transform", i3D 2006: <https://www.comp.nus.edu.sg/~tants/jfa.html>;
  summary and variants at <https://en.wikipedia.org/wiki/Jump_flooding_algorithm>;
  practical GPU walkthrough at
  <https://blog.demofox.org/2016/02/29/fast-voronoi-diagrams-and-distance-dield-textures-on-the-gpu-with-the-jump-flooding-algorithm/>
* Green (Valve), "Improved alpha-tested magnification for vector textures and special
  effects", SIGGRAPH 2007 courses: <https://dl.acm.org/doi/10.1145/1281500.1281665>
* Terrell, "Instanced Line Rendering": <https://wwwtyro.net/2019/11/18/instanced-lines.html>
* Mapbox, "Drawing antialiased lines with OpenGL":
  <https://medium.com/mapbox/drawing-antialiased-lines-with-opengl-8766f34192dc>
* Fisher (Gaffer on Games), "Fix Your Timestep!": <https://gafferongames.com/post/fix_your_timestep/>
* "How to (and how not to) fix color banding" (interleaved gradient noise):
  <https://blog.frost.kiwi/GLSL-noise-and-radial-gradient/>
* "Using fwidth for distance based anti-aliasing":
  <http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/>
* "Perfecting anti-aliasing on signed distance functions":
  <https://blog.pkh.me/p/44-perfecting-anti-aliasing-on-signed-distance-functions.html>

Libraries and data (source read directly):

* `mapbox/earcut`: <https://github.com/mapbox/earcut>
* `mapbox/tiny-sdf`: <https://github.com/mapbox/tiny-sdf/blob/main/index.js>
* MapLibre GL JS inertia handler:
  <https://github.com/maplibre/maplibre-gl-js/blob/main/src/ui/handler_inertia.ts>
* `d3-zoom`: <https://d3js.org/d3-zoom>
* `d3-geo`: <https://d3js.org/d3-geo>
* Natural Earth: <https://www.naturalearthdata.com/>, GeoJSON mirror
  <https://github.com/martynafford/natural-earth-geojson>
* `jhildenbiddle/canvas-size` (browser canvas limit matrix):
  <https://github.com/jhildenbiddle/canvas-size>

Other:

* WebGL2Fundamentals, Cross Platform Issues:
  <https://webgl2fundamentals.org/webgl/lessons/webgl-cross-platform-issues.html>
* WebGL2Fundamentals, Resizing the Canvas:
  <https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html>
* Playwright visual comparisons: <https://playwright.dev/docs/test-snapshots>
* Playwright `toHaveScreenshot` options: <https://playwright.dev/docs/api/class-pageassertions>
* createIT, headless Chrome WebGL with Playwright:
  <https://www.createit.com/blog/headless-chrome-testing-webgl-using-playwright/>

## Appendix B: what is UNVERIFIED

Listed explicitly so nobody treats these as measured facts:

1. Saito's EDT being slower than Felzenszwalb or Meijster in practice. Not benchmarked.
2. `Float32Array` being sufficient precision for the 3x-wide (24,576 column) EDT. Argued
   from the float32 mantissa, not measured.
3. Whether the equirectangular-metric distortion in the SDF is visibly wrong for
   continental-shelf halos at high latitudes. Needs a look at 70 degrees N.
4. `RG16F` seed precision for jump flooding at 8192 wide. I argue it is insufficient and
   `RG32F` is needed; not measured, and moot if you follow the CPU-EDT recommendation.
5. The cost of stroking 155,000 Canvas 2D line segments at 4K per frame. Asserted to be too
   slow; not benchmarked in a browser.
6. `powerPreference: 'high-performance'` materially improving this workload on a dual-GPU
   laptop.
7. SwiftShader's unavailability on macOS-arm64 affecting Playwright runs. Reported upstream,
   not reproduced here (this machine is Windows x64).
8. Real-browser canvas maximum sizes. I measured only headless SwiftShader, which allowed
   32768x1 and 16384x16384, more than the documented Chrome/Safari desktop limits. Trust the
   `canvas-size` matrix and MDN, not my numbers, for that one table.
