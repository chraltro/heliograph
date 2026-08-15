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

/*
 * Local time everywhere.
 *
 * Normally the whole map is one instant. In this mode every zone is drawn at
 * the same reading of its own clock instead, so the picture answers "how light
 * is it at five in the morning" for the entire world at once, and the zone
 * boundaries become visible steps in the light.
 *
 * It costs almost nothing, because of a small piece of arithmetic. At a fixed
 * local time, a zone whose offset is o is being drawn at the instant
 * T - o, and the subsolar longitude moves fifteen degrees for every hour of
 * that shift. Both terms fall out as a single shift of longitude: the Sun's
 * hour angle at a place depends only on how far that place lies from the
 * meridian its clock is keeping. So the mode is the ordinary calculation with
 * the longitude displaced, plus a small correction to the declination, which
 * drifts by up to a quarter of a degree across the fourteen hours of offset
 * that separate the extreme zones.
 */
uniform sampler2D uOffsets; // geographic raster of UTC offsets, hours
uniform float uLocalTime;   // 0 for one instant, 1 for one local time
uniform float uRefOffset;   // the offset whose clock the rest are matched to
uniform float uDecRate;     // change in solar declination, degrees per hour

/** The UTC offset in force at a point: the zone's, or nautical time at sea. */
float zoneOffset(vec2 lonlat) {
  vec4 texel = texture(uOffsets, vec2((lonlat.x + 180.0) / 360.0, (90.0 - lonlat.y) / 180.0));
  // The high seas keep nautical time, which really is the fifteen degree band.
  if (texel.a < 0.5) return floor(lonlat.x / 15.0 + 0.5);
  return texel.r * 32.0 - 12.0;
}

/** Geometric solar elevation in degrees. Mirrors elevationAt() in solar.ts. */
float solarElevation(vec2 lonlat) {
  float shift = uLocalTime > 0.0 ? zoneOffset(lonlat) - uRefOffset : 0.0;
  float lat = radians(lonlat.y);
  float dec = radians(uSun.x - uDecRate * shift);
  float ha = radians(lonlat.x - 15.0 * shift - uSun.y);
  float s = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(ha);
  return degrees(asin(clamp(s, -1.0, 1.0)));
}

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
`

/**
 * The Moon's shadow.
 *
 * A map of sunlight ought to know about the one thing that takes the sunlight
 * away. This is the same disc overlap as eclipse.ts, per pixel, and it has to
 * be per pixel: the Moon is close enough that two observers a few hundred
 * kilometres apart see it against measurably different sky, which is exactly
 * why totality is a track a hundred kilometres wide and not a hemisphere.
 *
 * Distances arrive in thousands of kilometres. A float carries about seven
 * digits, and subtracting an Earth radius from an astronomical unit in plain
 * kilometres would spend most of them.
 */
const ECLIPSE = /* glsl */ `
uniform vec3 uSunVec;    // geocentric equatorial, thousands of km
uniform vec3 uMoonVec;
uniform float uGmst;     // Greenwich mean sidereal time, degrees
uniform float uEclipse;  // 0 when no eclipse is anywhere near

const float EARTH_R = 6.37814;
const float SUN_R = 696.0;
const float MOON_R = 1.7374;

/** Fraction of the Sun's disc hidden at a point, by area. */
float obscuration(vec2 lonlat) {
  if (uEclipse <= 0.0) return 0.0;
  float theta = radians(uGmst + lonlat.x);
  float phi = radians(lonlat.y);
  vec3 observer = EARTH_R * vec3(cos(phi) * cos(theta), cos(phi) * sin(theta), sin(phi));
  vec3 toSun = uSunVec - observer;
  vec3 toMoon = uMoonVec - observer;
  // No Sun below the horizon to hide.
  if (dot(observer, toSun) <= 0.0) return 0.0;

  float ds = length(toSun);
  float dm = length(toMoon);
  float separation = acos(clamp(dot(toSun, toMoon) / (ds * dm), -1.0, 1.0));
  float rs = asin(SUN_R / ds);
  float rm = asin(MOON_R / dm);

  if (separation >= rs + rm) return 0.0;
  if (separation <= rm - rs) return 1.0;
  if (separation <= rs - rm) return (rm * rm) / (rs * rs);

  float a1 = acos(clamp((separation * separation + rs * rs - rm * rm) / (2.0 * separation * rs), -1.0, 1.0));
  float a2 = acos(clamp((separation * separation + rm * rm - rs * rs) / (2.0 * separation * rm), -1.0, 1.0));
  float area = rs * rs * (a1 - sin(2.0 * a1) * 0.5) + rm * rm * (a2 - sin(2.0 * a2) * 0.5);
  return clamp(area / (3.14159265 * rs * rs), 0.0, 1.0);
}

/**
 * What is left of the light. Totality is not darkness: the corona and the ring
 * of distant sunlit sky leave something like deep twilight on the ground, which
 * is about a ten thousandth of full daylight, so the floor is not zero.
 */
float eclipseShade(vec2 lonlat) {
  return 1.0 - 0.985 * obscuration(lonlat);
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

/**
 * Moonlight.
 *
 * A full moon at the zenith puts about a quarter of a lux on the ground against
 * daylight's hundred thousand, so this is never anything but a whisper. It is
 * still the reason a clear night with a moon up does not look like one without.
 *
 * The gain arrives already carrying the phase and the distance, worked out once
 * on the CPU; what has to happen per pixel is the geometry, because the Moon is
 * only up over half the world and its light falls off with the sine of its
 * altitude exactly as the Sun's does. The tint is cold because the dark adapted
 * eye is: at these levels vision is rod driven and the Purkinje shift shows.
 */
const MOONLIGHT = /* glsl */ `
uniform vec2 uMoon;        // sublunar longitude and latitude, degrees
uniform vec3 uMoonTint;    // scotopic blue grey, in linear light
uniform float uMoonGain;   // phase and distance already folded in; 0 turns it off

vec3 moonlight(vec2 lonlat, float solarElevationDeg) {
  if (uMoonGain <= 0.0) return vec3(0.0);
  float lat = radians(lonlat.y);
  float dec = radians(uMoon.y);
  float ha = radians(lonlat.x - uMoon.x);
  float sinAltitude = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(ha);
  if (sinAltitude <= 0.0) return vec3(0.0);
  // Only where the Sun has gone. Twilight is orders of magnitude brighter than
  // any moon, so the light fades in as the sky darkens rather than switching on.
  float night = 1.0 - smoothstep(-12.0, -1.0, solarElevationDeg);
  return uMoonTint * uMoonGain * sinAltitude * night;
}
`

// ---------------------------------------------------------------- zone offsets

/**
 * The UTC offset of every zone, rasterised into a geographic texture.
 *
 * Drawn once whenever the offsets change, which is when the date crosses a
 * daylight saving transition, rather than per frame. Equirectangular and
 * unprojected, so any later pass can sample it by longitude and latitude
 * without knowing anything about the view.
 */
export const ZONE_OFFSET_VS =
  VERSION +
  /* glsl */ `
precision highp float;
in vec2 aPosition;   // longitude and latitude, degrees
in float aOffset;    // the zone's current UTC offset, hours
out float vOffset;
void main() {
  vOffset = aOffset;
  gl_Position = vec4(aPosition.x / 180.0, aPosition.y / 90.0, 0.0, 1.0);
}
`

export const ZONE_OFFSET_FS =
  VERSION +
  /* glsl */ `
precision highp float;
in float vOffset;
out vec4 fragColor;
void main() {
  // Offsets run from -12 to +14 in quarter hours, so a byte holds them exactly
  // at a scale of 32 hours. Alpha marks the pixel as belonging to a zone at all.
  fragColor = vec4((vOffset + 12.0) / 32.0, 0.0, 0.0, 1.0);
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
  ECLIPSE +
  FRAG_COORDS +
  SHADING +
  MOONLIGHT +
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

  colour *= eclipseShade(lonlat);
  // Water is the darkest surface on the planet and reflects almost none of it.
  colour += moonlight(lonlat, elevation) * 0.35;

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
  ECLIPSE +
  SHADING +
  MOONLIGHT +
  /* glsl */ `
uniform float uIceAmount;
uniform sampler2D uTerrain;    // June albedo, decoded to linear by the sRGB sampler
uniform sampler2D uSeason;     // December over June, a linear gain, not a colour
uniform float uTerrainAmount;  // 0 until the textures have arrived
in vec2 vLonLat;
out vec4 fragColor;

/**
 * The median land pixel, ice excluded, in linear light, printed by
 * scripts/build-terrain.mjs. This is the "typical land" the spectral ramp was
 * built to describe, so imagery at this value comes out as exactly the ramp
 * colour and everything else is read as a departure from it.
 */
const vec3 TERRAIN_REF = vec3(0.0497, 0.0513, 0.0160);
/** The season texture holds ratio / 4, so a gain above one survives 8 bits. */
const float RATIO_SCALE = 4.0;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
/**
 * Orbit sees a far wider range than a map can print: dark boreal forest and
 * bright desert are a factor of thirty apart, and mapped straight through, one
 * would be black and the other would clip. Brightness is therefore compressed
 * about the typical land value, and the colour is carried separately so that
 * flattening the range does not also drain the hue out of the Sahara.
 */
const float TERRAIN_CONTRAST = 0.36;
const float TERRAIN_CHROMA = 0.72;

void main() {
  float elevation = solarElevation(vLonLat);
  float lat = vLonLat.y;
  vec2 uv = vec2((vLonLat.x + 180.0) / 360.0, (90.0 - lat) / 180.0);

  // Fine grain to suggest relief; quieter once the real imagery has loaded.
  float grain = periodicNoise(vLonLat * 0.5, 180.0) * 0.56
              + periodicNoise(vLonLat * 2.0, 720.0) * 0.30
              + periodicNoise(vLonLat * 7.0, 2520.0) * 0.14;
  grain = mix(grain, 0.5 + (grain - 0.5) * 0.35, uTerrainAmount);

  // The land as it actually was, photographed from orbit: Blue Marble's June
  // composite, carried into December by the measured ratio between the two
  // solstice months. The Sun's own declination says how far through that
  // journey we are, so the map needs no calendar to know the season: green
  // Siberia whitens, the Sahel dries, Patagonia's snow comes and goes, all of
  // it measured rather than invented. One texture holds every detail; the
  // other is a smooth gain, which is why the change costs almost no memory.
  float season = clamp(0.5 - uSun.x / 46.88, 0.0, 1.0);
  vec3 seasonGain = texture(uSeason, uv).rgb * RATIO_SCALE;
  vec3 texel = texture(uTerrain, uv).rgb * mix(vec3(1.0), seasonGain, season);

  // Brightness relative to typical land, compressed; colour relative to typical
  // land, kept. Their product is the albedo the ramp is then shaded through.
  float refLum = dot(TERRAIN_REF, LUMA);
  float lum = max(dot(texel, LUMA), 1e-5);
  float gain = pow(lum / refLum, TERRAIN_CONTRAST);
  vec3 chroma = (texel / lum) / (TERRAIN_REF / refLum);
  vec3 rel = clamp(gain * mix(vec3(1.0), chroma, TERRAIN_CHROMA), 0.0, 2.6);

  // Snow and ice identify themselves in the imagery: bright and colourless.
  // Because this reads the blended texel, the ice ramp follows the real snow
  // as it advances and retreats, and snow goes pink at sunset like snow.
  float peak = max(texel.r, max(texel.g, texel.b));
  float sat = (peak - min(texel.r, min(texel.g, texel.b))) / max(peak, 1e-4);
  float ice = smoothstep(0.34, 0.62, lum) * (1.0 - smoothstep(0.1, 0.26, sat)) * uTerrainAmount * uIceAmount;

  // Albedo is a daylight fact. Within a few degrees of the terminator the
  // atmosphere is most of what you can see, so the imagery lets go there and
  // every surface converges on the ramp's own twilight colour.
  float lit = smoothstep(-4.0, 8.0, elevation);
  vec3 albedo = mix(vec3(1.0), rel, lit * uTerrainAmount);

  vec3 base = mix(surfaceColour(uRampA, elevation) * albedo, surfaceColour(uRampB, elevation), ice);

  base *= eclipseShade(vLonLat);
  // Moonlight, off the ground's own albedo, so snow catches it and forest does
  // not. This is what makes a moonlit Greenland read against a black ocean.
  base += moonlight(vLonLat, elevation) * mix(rel, vec3(2.2), ice);

  fragColor = vec4(withDetail(base, grain, elevation), 1.0);
}
`

export const LAKE_FS =
  VERSION +
  COMMON +
  ECLIPSE +
  SHADING +
  MOONLIGHT +
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
  colour *= eclipseShade(vLonLat);
  colour += moonlight(vLonLat, elevation) * 0.35;
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
uniform float uDayFade;

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
  float lit = smoothstep(-8.0, 6.0, elevation);
  // In daylight the land draws its own coast: the shore is where the terrain
  // stops, and an outline over it only makes the map look like a printed
  // atlas. So the stroke fades out as the light comes up, and stays on the
  // night side, where without it the outline of the world would be lost.
  vec3 tint = mix(uNightTint, uDayTint, lit);
  float a = alpha * uIntensity * mix(1.0, uDayFade, lit);
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
