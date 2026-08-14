/**
 * All GLSL for the map, as ES 3.00 sources.
 *
 * The scene is composited in linear light into a floating point framebuffer and
 * tone mapped once at the end, so the sun glint and the brightest cities can run
 * past white and bloom instead of clipping to flat discs. Only those two things
 * write above 1.0, which is what makes the bloom mean something.
 */

const VERSION = '#version 300 es\n'

/** Projection and solar geometry, shared by every stage. */
const COMMON = /* glsl */ `
precision highp float;

uniform vec2 uResolution;   // drawing buffer size in pixels
uniform vec3 uView;         // centre longitude, centre latitude, world width in pixels
uniform float uLonOffset;   // which copy of the world this draw call is
uniform vec2 uSun;          // solar declination and subsolar longitude, degrees

/** Degrees to top-left origin screen pixels. */
vec2 projectDeg(vec2 lonlat) {
  float worldW = uView.z;
  float dLon = lonlat.x + uLonOffset - uView.x;
  return vec2(
    dLon / 360.0 * worldW + uResolution.x * 0.5,
    -(lonlat.y - uView.y) / 180.0 * (worldW * 0.5) + uResolution.y * 0.5
  );
}

/** Top-left origin screen pixels back to degrees. */
vec2 unprojectPx(vec2 px) {
  float worldW = uView.z;
  return vec2(
    (px.x - uResolution.x * 0.5) / worldW * 360.0 + uView.x,
    -(px.y - uResolution.y * 0.5) / (worldW * 0.5) * 180.0 + uView.y
  );
}

vec4 pxToClip(vec2 px) {
  vec2 n = px / uResolution * 2.0 - 1.0;
  return vec4(n.x, -n.y, 0.0, 1.0);
}

/** Geometric solar elevation in degrees. Mirrors elevationAt() in solar.ts. */
float solarElevation(vec2 lonlat) {
  float lat = radians(lonlat.y);
  float dec = radians(uSun.x);
  float ha = radians(lonlat.x - uSun.y);
  float s = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(ha);
  return degrees(asin(clamp(s, -1.0, 1.0)));
}
`

/** gl_FragCoord counts from the bottom; everything else here counts from the top. */
const FRAG_COORDS = /* glsl */ `
vec2 fragPx() {
  return vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
}
`

/**
 * Shading. Three ideas, all borrowed from how eyes and atmospheres actually work:
 * light falls off with the sine of the solar elevation, the sky keeps glowing
 * after the Sun has gone, and colour vision drains away into a fixed night blue
 * as the light goes (the Jensen scotopic shift that Stellarium uses).
 */
const SHADING = /* glsl */ `
uniform sampler2D uRampA;      // the surface ramp for this pass
uniform sampler2D uRampB;      // a second ramp to blend toward, where used
uniform vec2 uRampRange;       // elevation covered by the ramps
uniform float uSurfaceDetail;  // how much the albedo texture modulates the ramp

/**
 * What this surface looks like from overhead with the Sun at this elevation.
 * The whole twilight sequence, gold through rose through violet into the night
 * blue, lives in these tables. See palette.ts for where the numbers come from.
 */
vec3 surfaceColour(sampler2D ramp, float elevationDeg) {
  float t = (elevationDeg - uRampRange.x) / (uRampRange.y - uRampRange.x);
  return texture(ramp, vec2(clamp(t, 0.001, 0.999), 0.5)).rgb;
}

/**
 * Surface variation, applied to lightness only and faded out near the
 * terminator. Below about two degrees the atmosphere is most of what you can
 * see, so all surfaces converge on the same blue grey and texture must stop.
 */
vec3 withDetail(vec3 colour, float detail, float elevationDeg) {
  float visible = smoothstep(-4.0, 8.0, elevationDeg) * uSurfaceDetail;
  return colour * (1.0 + (detail - 0.5) * visible);
}

/** Cheap value noise in geographic space, so it does not swim when you pan. */
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/**
 * Value noise that repeats exactly every "period" cells along x. Longitude wraps,
 * so noise that does not wrap with it leaves a seam down the Pacific.
 */
float periodicNoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, period);
  float x1 = mod(i.x + 1.0, period);
  return mix(
    mix(hash21(vec2(x0, i.y)), hash21(vec2(x1, i.y)), u.x),
    mix(hash21(vec2(x0, i.y + 1.0)), hash21(vec2(x1, i.y + 1.0)), u.x),
    u.y
  );
}
`

// ---------------------------------------------------------------- base plate

/** A single oversized triangle covering the viewport. */
export const FULLSCREEN_VS =
  VERSION +
  /* glsl */ `
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

export const OCEAN_FS =
  VERSION +
  COMMON +
  FRAG_COORDS +
  SHADING +
  /* glsl */ `
uniform vec3 uGlint;
uniform float uGlintGain;
uniform vec2 uLonRange;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec2 lonlat = unprojectPx(fragPx());
  // Outside the plate there is no world, only the surround. The longitude range
  // is whatever the wrapped copies of the world actually cover, so the ocean
  // never extends past the continents drawn on it.
  if (lonlat.y > 90.0 || lonlat.y < -90.0) discard;
  if (lonlat.x < uLonRange.x || lonlat.x > uLonRange.y) discard;

  float elevation = solarElevation(lonlat);

  // A faint mottle stops the open ocean reading as flat vector fill.
  float mottle = periodicNoise(lonlat * 0.1, 36.0) * 0.62 + periodicNoise(lonlat * 0.5, 180.0) * 0.38;
  vec3 colour = withDetail(surfaceColour(uRampA, elevation), mottle, elevation);

  // Sun glint. The viewer is directly overhead at every point of an
  // equirectangular map, so the specular lobe is a tight disc centred exactly on
  // the subsolar point, which is (90 - elevation) degrees away. This is one of
  // only two things in the scene allowed past 1.0.
  float away = 90.0 - elevation;
  colour += uGlint * (exp(-away * away / 18.0) + exp(-away * away / 340.0) * 0.03) * uGlintGain;

  fragColor = vec4(colour, 1.0);
}
`

// ---------------------------------------------------------------- land fill

export const LAND_VS =
  VERSION +
  COMMON +
  /* glsl */ `
in vec2 aPosition;
out vec2 vLonLat;
void main() {
  vLonLat = aPosition;
  gl_Position = pxToClip(projectDeg(aPosition));
}
`

export const LAND_FS =
  VERSION +
  COMMON +
  SHADING +
  /* glsl */ `
uniform float uIceAmount;
in vec2 vLonLat;
out vec4 fragColor;

void main() {
  float elevation = solarElevation(vLonLat);
  float lat = vLonLat.y;

  // Three octaves of variation. Enough to suggest relief without pretending to
  // be a satellite image.
  float grain = periodicNoise(vLonLat * 0.5, 180.0) * 0.56
              + periodicNoise(vLonLat * 2.0, 720.0) * 0.30
              + periodicNoise(vLonLat * 7.0, 2520.0) * 0.14;

  // Two slow fields stand in for climate. One bends the band boundaries so no
  // zone follows a ruled parallel; the other stands in for how continental a
  // place is, and breaks deserts and snowfields into provinces. The x scales
  // must keep 360 times the scale an integer or the noise seams at the
  // antimeridian.
  float wobble = periodicNoise(vLonLat * vec2(0.05, 0.09), 18.0) - 0.5;
  float province = periodicNoise(vLonLat * vec2(0.125, 0.15) + vec2(31.7, 11.3), 45.0);
  float shifted = abs(lat + wobble * 14.0);

  // The latitudinal facts of the planet, as weights: rainforest about the
  // equator, the subtropical desert belt, the boreal forest, tundra past it.
  float tropics = 1.0 - smoothstep(8.0, 17.0, shifted);
  float desert = smoothstep(11.0, 19.0, shifted) * (1.0 - smoothstep(27.0, 38.0, shifted));
  desert *= 0.35 + 0.65 * province;
  float boreal = smoothstep(46.0, 55.0, shifted) * (1.0 - smoothstep(60.0, 68.0, shifted));
  float tundra = smoothstep(60.0, 68.0, shifted);

  // Albedo tints over the spectral land ramp, in linear light. Dry plains and
  // forest trade places on the province field inside every band.
  float verdure = periodicNoise(vLonLat * vec2(0.25, 0.3) + 7.0, 90.0);
  vec3 tint = mix(vec3(1.06, 0.99, 0.86), vec3(0.88, 1.03, 0.80), verdure);
  tint = mix(tint, vec3(0.62, 0.84, 0.44), tropics * (0.55 + 0.45 * province));
  tint = mix(tint, vec3(1.38, 1.07, 0.70), desert);
  tint = mix(tint, vec3(0.68, 0.84, 0.58), boreal * (0.5 + 0.5 * verdure));
  tint = mix(tint, vec3(1.06, 1.02, 0.94), tundra);

  // Albedo is a daylight fact. Within a few degrees of the terminator the
  // atmosphere is most of what you can see, so the tint lets go there and
  // every surface converges on the ramp's own twilight colour.
  float lit = smoothstep(-4.0, 8.0, elevation);
  vec3 albedo = mix(vec3(1.0), tint, lit * 0.9);

  // Ice and snow get their own ramp because high albedo surfaces keep catching
  // the reddened beam right up to the terminator, which is why snow goes pink
  // at sunset and water does not. The permanent caps are the high Arctic and
  // Antarctica; the seasonal cap follows the Sun, its edge ragged with noise,
  // reaching mid latitudes in the winter hemisphere and letting go in summer.
  float ragged = (periodicNoise(vLonLat * vec2(0.5, 0.7), 180.0) - 0.5) * 5.0 + wobble * 6.0;
  float snowLineN = 64.0 + uSun.x * 0.85;
  float snowLineS = 64.0 - uSun.x * 0.85;
  float seasonal = max(
    smoothstep(snowLineN - 3.0, snowLineN + 9.0, lat + ragged),
    smoothstep(snowLineS - 3.0, snowLineS + 9.0, -lat + ragged)
  ) * (0.55 + 0.45 * province);
  float permanent = max(smoothstep(69.0, 81.0, lat), smoothstep(60.0, 71.0, -lat));
  float ice = max(permanent, seasonal) * uIceAmount;

  vec3 base = mix(surfaceColour(uRampA, elevation) * albedo, surfaceColour(uRampB, elevation), ice);

  fragColor = vec4(withDetail(base, grain, elevation), 1.0);
}
`

export const LAKE_FS =
  VERSION +
  COMMON +
  SHADING +
  /* glsl */ `
in vec2 vLonLat;
out vec4 fragColor;

void main() {
  float elevation = solarElevation(vLonLat);
  // Inland water reads a shade deeper than the open ocean, which is both true
  // and useful: it keeps the Great Lakes and the Caspian legible against land.
  vec3 colour = surfaceColour(uRampA, elevation) * 0.82;
  float away = 90.0 - elevation;
  colour += vec3(0.92, 0.87, 0.74) * exp(-away * away / 40.0) * 0.45;
  fragColor = vec4(colour, 1.0);
}
`

// ---------------------------------------------------------------- lines

/**
 * Instanced line segments. Each instance carries its two endpoints in degrees;
 * the quad is expanded in screen space and the fragment shader measures the true
 * distance to the segment, which gives round caps and clean joins at any width.
 */
export const LINE_VS =
  VERSION +
  COMMON +
  /* glsl */ `
in vec2 aCorner;    // x runs 0..1 along the segment, y runs -1..1 across it
in vec4 aSegment;   // lon0, lat0, lon1, lat1
uniform float uWidth;
uniform float uFeather;

out vec2 vPx;
out vec2 vA;
out vec2 vB;
out vec2 vLonLat;

void main() {
  vec2 a = projectDeg(aSegment.xy);
  vec2 b = projectDeg(aSegment.zw);
  vec2 delta = b - a;
  float len = length(delta);
  vec2 dir = len > 1e-5 ? delta / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);

  float reach = uWidth * 0.5 + uFeather + 1.0;
  vec2 centre = mix(a, b, aCorner.x);
  vec2 p = centre + dir * (aCorner.x * 2.0 - 1.0) * reach + normal * aCorner.y * reach;

  vPx = p;
  vA = a;
  vB = b;
  vLonLat = mix(aSegment.xy, aSegment.zw, aCorner.x);
  gl_Position = pxToClip(p);
}
`

const SEGMENT_DISTANCE = /* glsl */ `
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
`

export const COASTLINE_FS =
  VERSION +
  COMMON +
  SEGMENT_DISTANCE +
  /* glsl */ `
uniform float uWidth;
uniform float uFeather;
uniform vec3 uDayTint;
uniform vec3 uNightTint;
uniform float uIntensity;

in vec2 vPx;
in vec2 vA;
in vec2 vB;
in vec2 vLonLat;
out vec4 fragColor;

void main() {
  float d = segmentDistance(vPx, vA, vB);
  float alpha = 1.0 - smoothstep(uWidth * 0.5 - uFeather, uWidth * 0.5 + uFeather, d);
  if (alpha <= 0.002) discard;

  float elevation = solarElevation(vLonLat);
  // Lit shores catch a warm rim; dark shores keep a cold one, so the outline of
  // the world never disappears entirely into the night side.
  float lit = smoothstep(-8.0, 6.0, elevation);
  vec3 tint = mix(uNightTint, uDayTint, lit);
  float a = alpha * uIntensity;
  fragColor = vec4(tint * a, a);
}
`

export const BORDER_FS =
  VERSION +
  COMMON +
  SEGMENT_DISTANCE +
  /* glsl */ `
uniform float uWidth;
uniform float uFeather;
uniform vec3 uTint;
uniform float uIntensity;

in vec2 vPx;
in vec2 vA;
in vec2 vB;
in vec2 vLonLat;
out vec4 fragColor;

void main() {
  float d = segmentDistance(vPx, vA, vB);
  float alpha = 1.0 - smoothstep(uWidth * 0.5 - uFeather, uWidth * 0.5 + uFeather, d);
  if (alpha <= 0.002) discard;
  float elevation = solarElevation(vLonLat);
  // Borders are a reference, not a subject. They never compete with the coast.
  float visible = mix(0.5, 1.0, smoothstep(-12.0, 8.0, elevation));
  float a = alpha * uIntensity * visible;
  fragColor = vec4(uTint * a, a);
}
`

// ---------------------------------------------------------------- city lights

export const CITY_VS =
  VERSION +
  COMMON +
  /* glsl */ `
in vec2 aCorner;      // -1..1 quad
in vec3 aCity;        // lon, lat, magnitude
uniform float uSizeMin;
uniform float uSizeMax;
uniform float uZoom;

out vec2 vUv;
out float vMagnitude;
out float vNight;
out float vFlux;

void main() {
  // Cull in daylight here rather than discarding per fragment. Roughly half the
  // world is lit at any moment, and a city halo is a big sprite, so throwing
  // them away before rasterisation halves the fill cost of this pass.
  float elevation = solarElevation(aCity.xy);
  vNight = 1.0 - smoothstep(-8.0, 2.0, elevation);
  if (vNight <= 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec2 centre = projectDeg(aCity.xy);
  // Bigger places get bigger halos, and the halo grows with the map so the lit
  // field keeps the same shape as you zoom. Scaling it any slower pulls the
  // glows apart and turns a continent into a field of separate dots.
  float scale = clamp(pow(uZoom, 0.8), 0.9, 3.5);
  float size = mix(uSizeMin, uSizeMax, pow(aCity.z, 1.7)) * scale;
  // A city emits a fixed amount of light. Spreading it over a larger halo has to
  // dim it, or every zoom step makes the continents brighter than the last.
  vFlux = 1.0 / pow(scale, 1.35);
  vUv = aCorner;
  vMagnitude = aCity.z;
  gl_Position = pxToClip(centre + aCorner * size);
}
`

export const CITY_FS =
  VERSION +
  /* glsl */ `
precision highp float;
uniform vec3 uLightColour;
uniform float uIntensity;

in vec2 vUv;
in float vMagnitude;
in float vNight;
in float vFlux;
out vec4 fragColor;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;

  // A hot core inside a soft halo, the shape a street grid makes from orbit.
  float core = exp(-r2 * 26.0);
  float halo = exp(-r2 * 3.4) * 0.3;
  float edge = 1.0 - smoothstep(0.49, 1.0, r2);

  float brightness = (core + halo) * edge * vNight * vFlux * uIntensity * (0.3 + 0.7 * vMagnitude);
  fragColor = vec4(uLightColour * brightness, 1.0);
}
`

// ---------------------------------------------------------------- subsolar glow

/**
 * The emissive halo under the subsolar marker. Drawn in the scene rather than on
 * the overlay so that it passes through the bloom, which is the difference
 * between a light source and a circle with a CSS shadow on it.
 */
export const SUNSPOT_VS =
  VERSION +
  COMMON +
  /* glsl */ `
in vec2 aCorner;
uniform float uSize;
out vec2 vUv;
void main() {
  vec2 centre = projectDeg(uSun.yx);
  vUv = aCorner;
  gl_Position = pxToClip(centre + aCorner * uSize);
}
`

export const SUNSPOT_FS =
  VERSION +
  /* glsl */ `
precision highp float;
uniform vec3 uColour;
uniform float uIntensity;
in vec2 vUv;
out vec4 fragColor;

void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float core = exp(-r * r * 46.0);
  float halo = exp(-r * r * 4.5) * 0.24;
  float bleed = pow(max(0.0, 1.0 - r), 3.0) * 0.1;
  fragColor = vec4(uColour * (core + halo + bleed) * uIntensity, 1.0);
}
`

// ---------------------------------------------------------------- bloom

/** Only what is genuinely overexposed is allowed to leak. */
export const BRIGHT_FS =
  VERSION +
  /* glsl */ `
precision highp float;
uniform sampler2D uScene;
uniform float uThreshold;
uniform float uSoftKnee;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 c = max(texture(uScene, vUv).rgb, 0.0);
  float brightness = max(c.r, max(c.g, c.b));
  float knee = uThreshold * uSoftKnee + 1e-5;
  float soft = clamp(brightness - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float weight = max(soft, brightness - uThreshold) / max(brightness, 1e-5);
  fragColor = vec4(c * weight, 1.0);
}
`

/** Separable Gaussian, nine taps, run once horizontally and once vertically. */
export const BLUR_FS =
  VERSION +
  /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uDirection;   // texel step, already scaled by the blur radius
in vec2 vUv;
out vec4 fragColor;

const float W0 = 0.2270270270;
const float W1 = 0.1945945946;
const float W2 = 0.1216216216;
const float W3 = 0.0540540541;
const float W4 = 0.0162162162;

void main() {
  vec3 sum = texture(uSource, vUv).rgb * W0;
  sum += (texture(uSource, vUv + uDirection * 1.0).rgb + texture(uSource, vUv - uDirection * 1.0).rgb) * W1;
  sum += (texture(uSource, vUv + uDirection * 2.0).rgb + texture(uSource, vUv - uDirection * 2.0).rgb) * W2;
  sum += (texture(uSource, vUv + uDirection * 3.0).rgb + texture(uSource, vUv - uDirection * 3.0).rgb) * W3;
  sum += (texture(uSource, vUv + uDirection * 4.0).rgb + texture(uSource, vUv - uDirection * 4.0).rgb) * W4;
  fragColor = vec4(sum, 1.0);
}
`

// ---------------------------------------------------------------- presentation

/**
 * Composite bloom, tone map, then the three things a real camera does to a real
 * frame: a whisper of radial colour separation at the edge, a vignette centred
 * slightly above the middle so it reads as a lens, and grain. Dithering happens
 * last, in display space, where banding actually lives.
 */
export const PRESENT_FS =
  VERSION +
  /* glsl */ `
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uTime;
in vec2 vUv;
out vec4 fragColor;

vec3 encodeSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

/** Interleaved gradient noise: cheap, and its spectrum hides banding well. */
float igNoise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 uv = vUv;
  vec2 offset = (uv - 0.5) * dot(uv - 0.5, uv - 0.5) * 4.0 * uAberration / uResolution.x;

  vec3 scene = vec3(
    texture(uScene, uv + offset).r,
    texture(uScene, uv).g,
    texture(uScene, uv - offset).b
  );
  scene += texture(uBloom, uv).rgb * uBloomStrength;

  // Exposure then an exponential roll off, which holds blacks at zero while
  // letting the glint and the brightest cities bloom out into white.
  vec3 mapped = vec3(1.0) - exp(-max(scene, 0.0) * uExposure);

  // A gentle corner falloff, centred a little above the middle. Dead centre
  // reads as a CSS effect; slightly high reads as a lens.
  vec2 centred = (uv - vec2(0.5, 0.45)) * vec2(1.0, uResolution.y / uResolution.x);
  mapped *= 1.0 - uVignette * smoothstep(0.30, 0.78, length(centred));

  vec3 srgb = encodeSrgb(mapped);
  float n = igNoise(gl_FragCoord.xy + vec2(uTime * 91.7, uTime * 43.1)) - 0.5;
  srgb += n * uGrain;
  srgb += (igNoise(gl_FragCoord.xy * 1.7) - 0.5) / 255.0;

  fragColor = vec4(srgb, 1.0);
}
`
