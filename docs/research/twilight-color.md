# The colour science of twilight, for a heliograph fragment shader

Research reference for mapping **solar elevation angle at a surface point** to **the colour that point should be drawn** in a full screen equirectangular world map.

Everything below is either (a) quoted from a cited primary source, (b) computed by me from cited constants (the scripts are reproduced so you can re-run them), or (c) explicitly labelled **UNVERIFIED / DESIGN JUDGEMENT**. Numbers with no label are verified.

---

## 0. Executive summary: the six things that matter most

1. **A nadir (satellite) view of the terminator is not a sunset photo.** From directly above, a point where the Sun sits at +3 degrees is lit by a heavily reddened direct beam but is *also* seen through a long, bright, blue Rayleigh path. Over dark ocean the path radiance wins and the pixel is a dark desaturated blue. Over bright land, snow and cloud the surface term wins and the pixel goes gold, then orange, then maroon. **This is the single strongest argument for separate ocean and land ramps**, and it is confirmed both by my spectral model (section 2.3) and by measurements I took from a live Himawari-9 full disk (section 2.2).
2. **The twilight sky is violet-blue, not pure blue, and its chroma peaks near solar elevation -8 degrees.** Derived from Patat et al. 2006 photometry (section 1.4). In OKLCH the hue runs roughly 262 degrees at the terminator, to 277 degrees at -8, to 283 degrees at -15, then swings warm as airglow takes over.
3. **The night floor is reached at about -15 to -16 degrees, not -18.** Patat et al. measured "the night sky brightness level is reached at around zeta = 105 to 106 degrees" (solar depression 15 to 16 degrees). Below that, nothing changes. Do not waste ramp resolution below -18.
4. **Luminance falls by a factor of about 2000 between -6 and -16 degrees.** No display can show that linearly. The ramp must be a designed, perceptually compressed curve, and its lightness axis should be built in OKLab L, not in sRGB.
5. **Interpolate the ramp in OKLab and dither before quantisation.** Across a 2560 pixel wide screen the day-to-night gradient crosses tens of steps of 8 bit output; without dither it will band visibly. Interleaved gradient noise at amplitude 1/255 is enough and costs three ALU ops.
6. **City lights are painted, not measured.** VIIRS Day/Night Band is a single panchromatic channel, 0.5 to 0.9 micrometres. Black Marble has no colour information at all. Every colour you have ever seen on a "city lights" image is an artistic choice. Pick yours deliberately.

---

## 1. What is actually happening, band by band

### 1.1 The formal definitions

From the US Naval Observatory, "Rise, Set, and Twilight Definitions" (https://aa.usno.navy.mil/faq/RST_defs):

| Event | Geometric definition | Solar zenith distance | USNO description |
|---|---|---|---|
| Sunrise / sunset | Sun's centre 50 arcmin below horizontal (16 arcmin semi-diameter + 34 arcmin refraction) | 90.8333 deg | "upper edge of the disk of the Sun is on the horizon" |
| Civil twilight ends | centre 6 deg below horizon | 96 deg | below this "artificial illumination is normally required to carry on ordinary outdoor activities" |
| Nautical twilight ends | centre 12 deg below | 102 deg | "the horizon is still visible even on a Moonless night allowing mariners to take reliable star sights" |
| Astronomical twilight ends | centre 18 deg below | 108 deg | beyond this "scattered light from the Sun is less than that from starlight and other natural sources" |

Note the 50 arcmin: **geometric solar elevation 0.0 is not sunset.** Apparent sunset happens at geometric elevation -0.8333 degrees. If your solar position code returns a geometric (unrefracted) elevation, the visual terminator on the map belongs at -0.83, not 0.0.

The Sun's angular diameter is 0.5334 degrees (mean), so the terminator has an intrinsic penumbra 0.53 degrees wide, which on the Earth's surface is about **59 km**. A terminator drawn as a hard line is physically wrong at any zoom where 59 km is more than one pixel.

### 1.2 Why the bands are where they are: Earth shadow height

The reason twilight ends near -18 is purely geometric. The top of the Earth's shadow above an observer whose solar depression is phi sits at height

```
h = R * (1 / cos(phi) - 1),   R = 6371 km
```

Computed (my calculation, plain trigonometry, no refraction):

| Solar elevation | Shadow top above the observer | What is still sunlit |
|---|---|---|
| 0 deg | 0 km | everything above the ground |
| -2 deg | 3.9 km | above the boundary layer |
| -4 deg | 15.6 km | above the tropopause |
| -6 deg (civil end) | 35.1 km | only the upper stratosphere and above |
| -8 deg | 62.6 km | mesosphere and above |
| -10 deg | 98.3 km | above the mesopause |
| -12 deg (nautical end) | 142.3 km | thermosphere only, negligible mass |
| -15 deg | 224.7 km | essentially nothing |
| -18 deg (astro end) | 327.9 km | nothing |
| -25 deg | 658.6 km | nothing |

This is independently corroborated: Patat et al. 2006 plot their model against "the lower Earth's boundary layer height in km" and mark "the Sun zenith distance when the lower boundary layer height is 120 km" (https://arxiv.org/pdf/astro-ph/0604128).

**Implication for the shader:** the useful twilight range is 0 to about -16. Everything below -16 should be a flat floor. If you spend 25 percent of your ramp between -18 and -25 you have wasted it.

### 1.3 Phenomena by elevation band

| Elevation band | Name | What it looks like | Source |
|---|---|---|---|
| +90 to +30 | High noon | Direct beam is near white with a faint warm cast; sky path radiance strongly blue; ocean deep navy; snow near white | my spectral model, section 2.3 |
| +30 to +6 | Afternoon into golden hour | Beam CCT falls steadily; direct beam #fff3d8 at +30, #ffcc75 at +6 | my spectral model |
| +6 to -4 | **Golden hour** | PhotoPills places golden hour at elevation -4 to +6 (https://www.photopills.com/articles/mastering-golden-hour-blue-hour-magic-hours-and-twilights). Long shadows, warm low-angle light | PhotoPills |
| +2 to -0.83 | **Sunset / sunrise** | Direct beam runs #ff9800 at +2, #ff4e00 at 0, transmitted flux 0.33 percent of TOA at 0 deg | my spectral model |
| 0 to -6 | **Belt of Venus / antitwilight arch**, and the rising Earth's shadow | A pink to rose band 10 to 20 degrees above the antisolar horizon, with the bluish grey dark segment of the Earth's shadow beneath it. Observed "during clear civil twilights". Caused by Rayleigh scattered, reddened sunlight backscattered toward the observer | Wikipedia "Belt of Venus"; Lee & Hernandez-Andres, "Measuring and modeling twilight's Belt of Venus", Appl. Opt. 54, B194 (2015), https://opg.optica.org/ao/abstract.cfm?uri=ao-54-4-b194 |
| -0.2 to -8.5 | **Purple light** | Pastel purple dominating the solar sky. Peak purity measured at about **-3.89 degrees** elevation. Requires scattering and extinction in *both* the troposphere and the stratosphere; background stratospheric aerosol alone is not enough | Lee & Hernandez-Andres, "Measuring and modeling twilight's purple light", Appl. Opt. 42, 445 (2003), https://opg.optica.org/ao/abstract.cfm?uri=ao-42-3-445 |
| -4 to -6 | **Blue hour** | PhotoPills places blue hour at -6 to -4. My derivation from Patat photometry (section 1.4) says the *chroma maximum* is a bit deeper, near -8, which matches the common experience that the deepest blue is later than the popular definition | PhotoPills; Patat et al. 2006 |
| -6 to -12 | Nautical twilight | Horizon still discernible. Sky luminance drops from 0.51 to 0.0015 cd/m2, i.e. by a factor of 350 | USNO; my calculation from Patat Table 1 |
| -12 to -18 | Astronomical twilight | Sky is dark, colour turns from violet-blue toward the warm airglow tint. **Night level is already reached by -15 to -16** | Patat et al. 2006: "In all passbands, the night sky brightness level is reached at around zeta = 105 to 106 degrees" |
| below -16 | **Full night** | Sky luminance floor about 1.7 to 2.5 x 10^-4 cd/m2 | Patat et al. 2006 (V = 21.6 mag/arcsec2 at Paranal); hnsky.org: "maximum darkness ... a SQM value of around 21.75 to 22 mag/arcsec2" (https://www.hnsky.org/sqm_twilight.htm) |
| night side | **Airglow** | Dominant natural night emission. About 20 percent of visible night sky light is in the single green oxygen line at **557.7 nm**. Highly variable, the largest single uncertainty in natural night sky brightness models | NPS Night Skies (https://www.nps.gov/subjects/nightskies/natural-light-in-night-sky.htm) |
| night side | **Earthshine** | Not relevant to the Earth's own night side, but the reciprocal quantity is: Earth's Bond albedo is **0.30**, the Moon's is 0.12. Moonlight illuminates Earth's night side at about **0.25 lux at full Moon**, versus 0.002 lux for starlight plus airglow | BBSO Earthshine project (https://www.bbso.njit.edu/Earthshine_webpage.html); Wikipedia "Daylight" illuminance table |

### 1.4 Measured twilight sky brightness and colour (the key quantitative source)

Patat, Ugolnikov & Postylyakov, "UBVRI twilight sky brightness at ESO-Paranal", A&A 455, 385 (2006), arXiv astro-ph/0604128. Over 2000 FORS1 images, Sun zenith distance 94 to 112 degrees.

Their **Table 1**, fitted zenith sky surface brightness in mag/arcsec2, valid for 95 <= zeta <= 105 degrees:

```
m(zeta) = a0 + a1*(zeta - 95) + a2*(zeta - 95)^2
```

| Filter | a0 | a1 (per deg) | a2 (per deg^2) | sigma | gamma (mag/arcsec2 per deg) |
|---|---|---|---|---|---|
| U | 11.78 | 1.376 | -0.039 | 0.24 | 1.23 +/- 0.01 |
| B | 11.84 | 1.411 | -0.041 | 0.12 | 1.24 +/- 0.01 |
| V | 11.84 | 1.518 | -0.057 | 0.18 | 1.14 +/- 0.02 |
| R | 11.40 | 1.567 | -0.064 | 0.29 | 1.09 +/- 0.03 |
| I | 10.93 | 1.470 | -0.062 | 0.40 | 0.94 +/- 0.03 |

Reference colours quoted in the same paper: the **Sun** has U-B = 0.13, B-V = 0.65, V-R = 0.52, V-I = 0.81; the **Paranal night sky** has U-B = -0.36, B-V = 1.03, V-R = 0.74, V-I = 1.90.

Their physical narrative, quoted: "since multiple scattering boosts the light at shorter wavelengths with respect to the pure single scattering component, the overall color gets bluer and bluer as the Sun deepens below the horizon. Then, at some point, the night sky glow which has completely different colours, starts to contribute and the colors progressively turn to those typical of the night sky."

**My derivation from those numbers.** I evaluated the polynomials, converted V surface brightness to luminance with the standard 1 cd/m2 = 12.58 mag/arcsec2, and formed a "white balanced to sunlight" linear RGB by taking the flux ratios B/V and R/V relative to the Sun's own colour indices:

```
G = 1
R = 10^( +0.4 * ((V-R)_sky - 0.52) )
B = 10^( -0.4 * ((B-V)_sky - 0.65) )
```

| Solar elev | zeta | m_V | Sky luminance | B-V | V-R | R,G,B (WB to sunlight) | Hue as hex (exposure normalised) | OKLCH hue |
|---|---|---|---|---|---|---|---|---|
| -5.0 | 95.0 | 11.84 | 1.98 cd/m2 | 0.00 | 0.44 | 0.929, 1.000, 1.820 | #bdc4ff | 279.2 |
| -6.0 | 96.0 | 13.30 | 0.515 | -0.09 | 0.40 | 0.894, 1.000, 1.979 | #b3bcff | ~278 |
| -7.0 | 97.0 | 14.65 | 0.149 | -0.15 | 0.37 | 0.871, 1.000, 2.089 | #adb8ff | ~277 |
| **-8.0** | 98.0 | 15.88 | 0.0478 | **-0.18** | 0.36 | 0.860, 1.000, 2.142 | **#aab6ff** | **276.6 (chroma max)** |
| -9.0 | 99.0 | 17.00 | 0.0171 | -0.17 | 0.36 | 0.860, 1.000, 2.132 | #aab6ff | ~277 |
| -10.0 | 100.0 | 18.00 | 6.76e-3 | -0.13 | 0.37 | 0.871, 1.000, 2.061 | #aeb9ff | ~278 |
| -12.0 | 102.0 | 19.67 | 1.46e-3 | 0.03 | 0.44 | 0.929, 1.000, 1.762 | #c0c6ff | 279.8 |
| -14.0 | 104.0 | 20.89 | 4.76e-4 | 0.33 | 0.57 | 1.043, 1.000, 1.339 | #e4e0ff | ~291 |
| -15.0 | 105.0 | 21.32 | 3.19e-4 | 0.53 | 0.65 | 1.127, 1.000, 1.117 | #fff2fe | ~330 |
| -16.0 | 106.0 | 21.64 | 2.38e-4 | 0.76 | 0.75 | 1.234, 1.000, 0.904 | #ffe8de | 45.0 (warm) |
| night | - | 21.6 | 2.47e-4 | 1.03 | 0.74 | 1.225, 1.000, 0.705 | #ffe9c8 | ~78 (airglow) |

Read this table as **hue only**: the hex values are exposure normalised so you can see the chromaticity. The luminance column is the real one.

Three consequences for the ramp:

- The twilight sky is **violet-blue** (OKLCH hue 276 to 280), not the cyan-blue of the daytime sky (hue 245 to 258). Rotating the ramp hue positively as the sun sinks is physically correct and looks much better than holding one blue.
- **Chroma peaks at about -8 degrees.** This is the visual "blue hour" for a satellite view. Put your most saturated twilight stop there, not at -4.
- Below about -13 the hue swings back warm because airglow (which is warm in B-V and very warm in V-I) takes over. A tiny warm cast on the deep night side is physically justified, though it fights legibility. See section 2.6.

**Caveat.** These are *ground based zenith* measurements. A satellite looking down sees the same scattering volume from the other side, so the spectral behaviour is closely related but not identical. Also, at these luminances the human eye is scotopic (purely scotopic below 1e-3 cd/m2, mesopic 1e-3 to 3 cd/m2, per https://www.rp-photonics.com/scotopic_and_photopic_vision.html), so a real observer sees no colour at all below about -10.5 degrees. A map should still show colour: it is an information display, not a simulation of your dark adapted retina.

### 1.5 A second, independent brightness relation

hnsky.org measured sky brightness in SQM units against solar elevation x (degrees, negative below horizon) and fitted (https://www.hnsky.org/sqm_twilight.htm):

- for 0 to -12 deg: `SQM = -1.057*x + 6.7489`
- for -12 to -18 deg: `SQM = -0.0744*x^2 - 2.5768*x - 0.5845`

Sanity check at -12: first form gives 19.43, second gives 19.61. Patat gives m_V = 19.67. The three agree within about 0.25 mag, which is well inside night to night variation. Use Patat, but this is a useful cross check and the linear form is cheap enough to evaluate in a shader if you want a physical luminance curve rather than a hand tuned one.

---

## 2. The colour ramps (the main deliverable)

### 2.1 Anchor measurements I took myself

I sampled real imagery so that the ramp is pinned to reality rather than taste. Each image was downloaded directly from the publisher; the two non-trivial scripts are reproduced in Appendix A so you can re-run and extend the measurements.

**Apollo 17 "Blue Marble", AS17-148-22727** (NASA image library, `as17-148-22727~medium.jpg`). Luminance sorted percentiles over the illuminated disk:

| Percentile | Hex | OKLCH |
|---|---|---|
| p02 (darkest clear ocean) | `#03193e` | L 0.223, C 0.077, H 259 |
| p05 | `#072045` | L 0.249, C 0.076, H 258 |
| p10 | `#102a4e` | L 0.286, C 0.073, H 257 |
| p25 (shelf sea, haze, thin cloud) | `#3b4f6b` | L 0.423, C 0.053, H 257 |
| p50 | `#8b92a0` | L 0.659, C 0.022, H 264 |
| p90 (cloud) | `#d5d9df` | L 0.884, C 0.009, H 258 |
| p98 (bright cloud) | `#eeefef` | L 0.951, C 0.001 |

**NASA Blue Marble `land_shallow_topo_2048.jpg`** (https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg), point samples:

| Feature | Hex |
|---|---|
| Deep ocean (this product uses a synthetic bathymetry shade) | `#0b0a32` |
| Sahara 23N 12E | `#fadb96` |
| Arabian desert 22N 47E | `#fdeab1` |
| Amazon 3S 62W | `#20380a` |
| Congo 1S 22E | `#283b0a` |
| Boreal Siberia 62N 100E | `#32450e` |
| US Great Plains 41N 100W | `#565d2b` |
| Europe cropland 50N 15E | `#3d5017` |
| Australia outback 25S 130E | `#8e6344` |
| Greenland ice 72N 40W | `#ffffff` |
| Antarctica 82S 0E | `#afaba3` |
| Caribbean shallow 24N 78W | `#2f8885` |
| **Median of all non-ocean pixels** | **`#6f6a46`** (OKLCH L 0.519, C 0.053, H 101) |
| Median non-ocean, abs(lat) < 55 | `#535b2d` (L 0.453, C 0.068, H 117) |

That median land colour is the single most useful anchor for a "generic sunlit land" ramp stop.

**NASA Black Marble 2016, 0.1 degree** (https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg):

- City cores clip to 255 in all channels (Tokyo, Seoul, Moscow, Paris, Mexico City all `#ff...` saturated).
- **Mean colour of all pixels with luminance > 150: `#dacbb0`** (linear ratio 1.00 : 0.93 : 0.81). A warm off white.
- Radial profile around Tokyo, in 0.1 deg pixels (about 11 km each), relative luminance: r=0 -> 250, r=2 -> 216, r=4 -> 147, r=6 -> 68, r=8 -> 42, r=10 -> 33, r=12 -> 20, r=14 -> 13. That is roughly a **1/r^2.2 falloff over the first 6 pixels then a long shallow tail**, which is exactly the shape a Gaussian core plus a wide low amplitude halo reproduces.
- Cairo's profile is much flatter (r=4 -> 129, r=10 -> 105, r=16 -> 51): the Nile delta is a continuous lit region, not a point. Real night lights are a mixture of point sources and extended sheets.

### 2.2 Measured colour versus solar elevation from a live geostationary satellite

This is the strongest evidence in the document. I downloaded Himawari-9 full disk true colour images from NICT (https://himawari8.nict.go.jp/) for 2026-08-14, inverted the geostationary projection (standard LRIT/HRIT formulation, sub-satellite longitude 140.7E, COFF/LOFF 2750.5 and CFAC/LFAC 20466275 on the 5500 grid, scaled to the 550 px product), computed the solar elevation for every pixel, and binned.

**Self validation:** the imagery goes to pure black in exactly the bin `-2 .. 0` degrees and first becomes non-zero in `0 .. +2`. That the measured terminator lands on computed elevation zero confirms both the projection inversion and the solar ephemeris.

Clear-sky open ocean, taken as the 5th percentile of luminance within each elevation bin (the 5th percentile is cloud free water; the 90th percentile is cloud top), aggregated over 12 image times:

| Solar elevation | Clear ocean (p05) | OKLCH | Cloud top (p90) |
|---|---|---|---|
| +70 .. +72 | `#102e49` | L 0.30 | `#7f91a9` |
| +60 .. +62 | `#072946` | L 0.28 | `#a2b4cc` |
| +50 .. +52 | `#032745` | L 0.27, C 0.068, H 249 | `#a3b4cc` |
| +40 .. +42 | `#042845` | L 0.269, C 0.065, H 247 | `#8898ae` |
| +30 .. +32 | `#07253d` | L 0.25 | `#758395` |
| +20 .. +22 | `#081c2c` | L 0.219, C 0.041, H 245 | `#4a5564` |
| +14 .. +16 | `#061826` | L 0.20 | `#353f4a` |
| +10 .. +12 | `#05141f` | L 0.184, C 0.031, H 241 | `#1f2832` |
| +6 .. +8 | `#040d13` | L 0.16 | `#131a21` |
| +4 .. +6 | `#04090e` | L 0.136, C 0.015, H 242 | `#0e1318` |
| +2 .. +4 | `#010509` | L 0.10 | `#090c10` |
| 0 .. +2 | `#000000` (product clips) | - | `#03070a` |

Australian desert interior (land) for comparison, high sun, p05 to p50: `#372330` to `#492c35`. That is a dark maroon: red soil plus a blue Rayleigh path, which is why blue exceeds green.

**Two independent day side anchors agree.** Apollo 17 p05 ocean `#072045` (L 0.249, C 0.076, H 258) and Himawari clear ocean at +50 `#032745` (L 0.271, C 0.068, H 249). Real clear deep ocean from space at high sun is OKLab L about 0.25 to 0.29, chroma 0.065 to 0.078, hue 249 to 259.

**Caveats.** The NICT product is 8 bit sRGB for display and is noticeably dark overall (cloud tops top out near `#a9b4ca` rather than white). NICT and CIRA both apply a Rayleigh correction to their true colour products, which removes some of the atmospheric blue (Murata, Saitoh & Sumida 2018; and GeoColor V2.0 "atmospheric (Rayleigh scattering) correction ... adapted from SeaDAS"). NICT also masks the night side to black. Treat these numbers as reliable for **hue and relative lightness ordering**, and as an underestimate of absolute lightness.

### 2.3 A physically derived ramp

I built a small spectral model using only published constants, then rendered it through the CIE observer. Constants taken verbatim from `ebruneton/precomputed_atmospheric_scattering`, `atmosphere/demo/demo.cc` (https://github.com/ebruneton/precomputed_atmospheric_scattering):

- Solar spectrum: ASTM G-173 ETR column, 48 bins of 10 nm from 360 to 830 nm, W m^-2 nm^-1.
- Ozone cross section: IUP Bremen 2011 reference spectra at 233 K, 48 bins, m^2. Column 300 DU with 1 DU = 2.687e20 molecules m^-2.
- Rayleigh: `beta_R = 1.24062e-6 * lambda_um^-4` m^-1 at sea level, scale height 8000 m. (Cross check: this gives vertical tau_R(550 nm) = 0.0973, the standard textbook value.)
- Mie: Angstrom beta 5.328e-3, alpha 0, single scattering albedo 0.9, Henyey-Greenstein g = 0.8, scale height 1200 m. I substituted a more typical AOD(550) of 0.05 with Angstrom alpha 1.3 for the results below.
- Air mass: Kasten & Young (1989), `m = 1 / (sin h + 0.50572 * (h + 6.07995)^-1.6364)`.
- CIE 1931 2 degree colour matching functions: Wyman, Sloan & Shirley, "Simple Analytic Approximations to the CIE XYZ Color Matching Functions", JCGT 2(2), 2013 (https://jcgt.org/published/0002/02/01/paper.pdf), multi-lobe Gaussian fit, exact code in section 4.6.
- XYZ to linear sRGB with the standard sRGB matrix; **white point is the unattenuated solar spectrum**, so "white" means "the colour of sunlight in space". Sanity check: feeding the model the unattenuated solar spectrum returns exactly `#ffffff`.

**Result A: colour of the direct solar beam reaching the ground.**

| Solar elevation | Air mass | Transmitted / TOA | Linear RGB (WB to sunlight) | Hue as hex |
|---|---|---|---|---|
| 90 | 1.00 | 0.832 | 0.873, 0.829, 0.724 | `#fff9eb` |
| 60 | 1.15 | 0.809 | 0.856, 0.805, 0.688 | `#fff8e8` |
| 45 | 1.41 | 0.771 | 0.826, 0.766, 0.633 | `#fff7e3` |
| 30 | 1.99 | 0.693 | 0.764, 0.686, 0.524 | `#fff3d8` |
| 20 | 2.90 | 0.587 | 0.676, 0.577, 0.390 | `#ffeec8` |
| 15 | 3.81 | 0.498 | 0.599, 0.485, 0.290 | `#ffe8b9` |
| 10 | 5.59 | 0.362 | 0.472, 0.345, 0.162 | `#ffde9e` |
| 8 | 6.86 | 0.288 | 0.398, 0.270, 0.107 | `#ffd78d` |
| 6 | 8.84 | 0.203 | 0.305, 0.183, 0.054 | `#ffcc75` |
| 5 | 10.31 | 0.157 | 0.250, 0.138, 0.033 | `#ffc465` |
| 4 | 12.30 | 0.111 | 0.191, 0.093, 0.016 | `#ffb951` |
| 3 | 15.15 | 0.068 | 0.130, 0.053, 0.005 | `#ffab36` |
| 2 | 19.43 | 0.033 | 0.073, 0.023, 0.000 | `#ff9800` |
| 1 | 26.31 | 0.011 | 0.029, 0.006, 0.000 | `#ff7b00` |
| 0 | 37.92 | 0.0018 | 0.006, 0.001, 0.000 | `#ff4e00` |

This table is directly usable: it is the **multiplier you apply to a surface albedo texture** on the day side. It is why golden hour is golden and why the setting sun is red, with real numbers.

**Result B: nadir top-of-atmosphere colour**, single scattering path radiance plus a Lambertian surface, all four surface types on one common exposure (exposure chosen so that snow at h = 60 lands at linear 0.85):

| Elev | Ocean | Vegetation | Desert | Snow |
|---|---|---|---|---|
| +80 | `#445d7d` L 0.105 | `#576a7c` L 0.138 | `#a39186` L 0.298 | `#fdf7ea` L 0.936 |
| +60 | `#3e5572` L 0.087 | `#506271` L 0.116 | `#98867b` L 0.253 | `#ede7d8` L 0.799 |
| +40 | `#34475f` L 0.061 | `#43525e` L 0.080 | `#827166` L 0.175 | `#cbc3b3` L 0.552 |
| +20 | `#273545` L 0.034 | `#303b45` L 0.042 | `#5a4e48` L 0.082 | `#8e8574` L 0.238 |
| +10 | `#1e2833` L 0.021 | `#232b33` L 0.023 | `#3a3434` L 0.036 | `#5a5144` L 0.084 |
| +6 | `#192028` L 0.014 | `#1b2128` L 0.015 | `#282528` L 0.019 | `#3b342d` L 0.035 |
| +4 | `#141a20` L 0.010 | `#151b20` L 0.010 | `#1c1c20` L 0.012 | `#282321` L 0.018 |
| +2 | `#0d1115` L 0.005 | `#0d1115` L 0.005 | `#0f1115` L 0.006 | `#141215` L 0.006 |
| +1 | `#07090c` | `#07090c` | `#07090c` | `#09090c` |

Notice how **all four surfaces converge on the same blue grey below +2 degrees**: the atmosphere is the only thing you can see. That convergence is real and your ramps should reproduce it, otherwise you get an ugly discontinuity where land meets sea at the terminator.

The model is systematically lighter and less saturated than the Himawari measurement, because plane parallel single scattering over-predicts brightness near the terminator (a spherical shell with multiple scattering does better). Trust the model for **hue** and the measurements for **lightness**.

### 2.4 The ramps

These are the deliverable. Each is 16 stops from +90 to -25, specified as `(solarElevationDegrees, hex)` and, because you will want to edit them, as OKLCH so the ramp's structure is visible. Generated by a script that converts OKLCH to sRGB with Ottosson's matrices and checks the round trip; the round trip error is under 0.002 in L for every stop.

#### 2.4.1 OCEAN

```
+90  #123b61      -2   #0d1733
+60  #123a5f      -4   #0b1030
+30  #113659      -6   #0a0b2b
+18  #0f3052      -9   #070625
+12  #0f2c4c     -12   #06041c
 +6  #0f2644     -15   #050414
 +2  #0f213c     -18   #03040f
  0  #0f1d38     -25   #02040e
```

| Elev | Hex | OKLab L | C | H | Justification |
|---|---|---|---|---|---|
| +90 | `#123b61` | 0.345 | 0.080 | 250 | Apollo 17 p10 ocean is L 0.286 C 0.073 H 257; Himawari clear ocean at +50 is L 0.271 C 0.068 H 249. Lifted about +0.06 in L for screen legibility. **DESIGN JUDGEMENT** on the lift, measured on hue and chroma. |
| +60 | `#123a5f` | 0.341 | 0.079 | 250 | Day plateau. Himawari shows almost no change between +40 and +70. |
| +30 | `#113659` | 0.326 | 0.075 | 250 | Himawari +30 `#07253d` is 0.02 lower in L than +50; same step used here. |
| +18 | `#0f3052` | 0.305 | 0.072 | 252 | GeoColor begins its night fade at cos(SZA) = 0.3, i.e. elevation +17.5. Start the visible fall here. |
| +12 | `#0f2c4c` | 0.290 | 0.068 | 253 | Himawari `#05141f` at +10..+12 has C 0.031; chroma held higher here deliberately, see "muddy midpoints", section 4.4. |
| +6 | `#0f2644` | 0.268 | 0.063 | 256 | GeoColor's fade completes at cos(SZA) = 0.1, elevation +5.7. Also the civil twilight mirror point. |
| +2 | `#0f213c` | 0.248 | 0.057 | 258 | Beam transmission has collapsed to 3 percent (section 2.3 result A) but path radiance still dominates over water. Hue starts rotating violet. |
| 0 | `#0f1d38` | 0.235 | 0.056 | 262 | The terminator. Draw it here for geometric elevation, or at -0.83 if you want the apparent (refracted) sunset. |
| -2 | `#0d1733` | 0.213 | 0.057 | 267 | Earth shadow top 3.9 km: the boundary layer is dark, the free troposphere is still lit. Purple light region begins (peak purity at -3.9). |
| -4 | `#0b1030` | 0.191 | 0.064 | 272 | Shadow top 15.6 km. Purple light maximum. Chroma rising, per Patat derivation. |
| -6 | `#0a0b2b` | 0.173 | 0.063 | 276 | Civil twilight ends, shadow top 35 km. Measured sky hue at -6 is 278; sky luminance 0.51 cd/m2. |
| -9 | `#070625` | 0.151 | 0.063 | 278 | Between the measured chroma peak (-8, hue 276.6) and the start of the airglow turn. Sky luminance 0.017 cd/m2. |
| -12 | `#06041c` | 0.133 | 0.053 | 282 | Nautical twilight ends, shadow top 142 km. Measured hue 279.8, chroma starting to fall. Luminance 1.5e-3 cd/m2. |
| -15 | `#050414` | 0.122 | 0.038 | 283 | Patat: night level reached at zeta 105 to 106, i.e. -15 to -16. Luminance 3.2e-4. |
| -18 | `#03040f` | 0.114 | 0.029 | 273 | Astronomical twilight ends. Hue pulled back toward neutral to acknowledge the airglow turn without going visibly warm. |
| -25 | `#02040e` | 0.111 | 0.028 | 267 | Flat floor. Nothing changes below -16 in reality. Keeping L at 0.11 rather than near zero leaves headroom for city lights, aurora and coastlines to read. **DESIGN JUDGEMENT.** |

#### 2.4.2 LAND

```
+90  #7b764f      -2   #581e06
+60  #7a734b      -4   #461315
+30  #766d42      -6   #330d22
+18  #736335      -9   #180c29
+12  #715b28     -12   #0b0921
 +6  #6e4d13     -15   #080717
 +2  #6a3a00     -18   #050612
  0  #652f00     -25   #030711
```

| Elev | Hex | OKLab L | C | H | Justification |
|---|---|---|---|---|---|
| +90 | `#7b764f` | 0.560 | 0.056 | 102 | Median of all non-ocean Blue Marble pixels is `#6f6a46`, OKLCH L 0.519 C 0.053 H 101. Lifted +0.04 L. |
| +60 | `#7a734b` | 0.552 | 0.058 | 100 | Day plateau; direct beam is `#fff8e8`, only 3 percent warmer than at zenith. |
| +30 | `#766d42` | 0.532 | 0.062 | 98 | Beam is `#fff3d8`. Chroma rises as the beam warms even though L barely moves. |
| +18 | `#736335` | 0.504 | 0.067 | 91 | Beam `#ffebc2` region; hue crosses out of green-yellow into yellow. |
| +12 | `#715b28` | 0.482 | 0.074 | 86 | Beam `#ffe2ac`. |
| +6 | `#6e4d13` | 0.446 | 0.084 | 77 | **Golden hour core.** Beam `#ffcc75` (OKLCH H 79.5). The ramp hue tracks the physically derived beam hue almost exactly here. |
| +2 | `#6a3a00` | 0.400 | 0.092 | 62 | Beam `#ff9800` (H 64.1). Beam transmission 3 percent, so land is going dark fast. |
| 0 | `#652f00` | 0.371 | 0.094 | 53 | Beam `#ff4e00` (H 37.2). I hold the ramp warmer than pure red because the diffuse sky (still blue) is now a large fraction of the illumination. |
| -2 | `#581e06` | 0.321 | 0.092 | 40 | No direct beam at the surface. Colour is the sunlit troposphere overhead: reddened, so this is the map's version of the **antitwilight / Belt of Venus** rose. |
| -4 | `#461315` | 0.273 | 0.078 | 22 | **Purple light peak (-3.89 deg measured).** Hue rotating from red toward magenta. |
| -6 | `#330d22` | 0.232 | 0.067 | 349 | Civil twilight ends. Magenta, the crossover between the reddened Belt of Venus and the violet-blue upper sky. |
| -9 | `#180c29` | 0.189 | 0.057 | 300 | Now dominated by high altitude scattering. Approaching the measured sky hue (277) via violet. |
| -12 | `#0b0921` | 0.160 | 0.049 | 283 | Nautical twilight ends. Matches measured sky hue 279.8 within 3 degrees. |
| -15 | `#080717` | 0.141 | 0.035 | 284 | Night level reached. |
| -18 | `#050612` | 0.129 | 0.028 | 277 | Astronomical twilight ends. |
| -25 | `#030711` | 0.129 | 0.025 | 260 | Floor, 0.018 in L above the ocean floor so coastlines remain faintly readable at night without an explicit outline. **DESIGN JUDGEMENT.** |

#### 2.4.3 ICE AND SNOW (yes, it is warranted)

It is warranted for three reasons. First, high albedo surfaces are the one case where the reddened direct beam dominates over the blue path radiance right up to the terminator, so ice goes *pink*, not grey (my model result B: snow at +6 is `#3b342d`, warm, while ocean at +6 is `#192028`, cold). Second, alpenglow on snow is the single most recognisable low sun colour phenomenon on Earth and it will make your polar regions beautiful. Third, at high latitudes the sun spends hours between -6 and +6, so this is the part of the map that a viewer will stare at longest.

```
+90  #f3f2eb      -2   #ac716a
+60  #efede3      -4   #8c5863
+30  #e7e2d2      -6   #664663
+18  #e1d5bf      -9   #3a3355
+12  #ddcab1     -12   #23233e
 +6  #d5b599     -15   #17172a
 +2  #cd9b82     -18   #0f1220
  0  #c58c78     -25   #0c121e
```

| Elev | Hex | OKLab L | C | H | Justification |
|---|---|---|---|---|---|
| +90 | `#f3f2eb` | 0.960 | 0.009 | 100 | Blue Marble Greenland is `#ffffff`, Antarctica `#afaba3` (L 0.742). Pulled just off white so bloom and cloud can still be brighter. |
| +60 | `#efede3` | 0.945 | 0.013 | 97 | Model snow at +60 `#ede7d8`, near identical. |
| +30 | `#e7e2d2` | 0.912 | 0.022 | 93 | Model `#dcd7c6` region. Beam `#fff3d8`. |
| +18 | `#e1d5bf` | 0.877 | 0.032 | 83 | |
| +12 | `#ddcab1` | 0.848 | 0.040 | 75 | Model snow at +10 is `#5a5144` because the model exposes for a physical scene; here the ramp is exposed for a display, so L stays high and only chroma and hue carry the story. **DESIGN JUDGEMENT.** |
| +6 | `#d5b599` | 0.794 | 0.053 | 63 | Beam `#ffcc75`. Snow reflects the beam almost neutrally, so snow colour tracks beam colour. |
| +2 | `#cd9b82` | 0.730 | 0.070 | 48 | Beam `#ff9800`. **Alpenglow.** |
| 0 | `#c58c78` | 0.691 | 0.076 | 40 | Beam `#ff4e00` but heavily diluted by blue skylight on a horizontal snowfield. |
| -2 | `#ac716a` | 0.609 | 0.076 | 27 | Post sunset alpenglow, lit by the reddened free troposphere. |
| -4 | `#8c5863` | 0.521 | 0.070 | 6 | Purple light peak. The famous cold pink. |
| -6 | `#664663` | 0.440 | 0.062 | 330 | Civil twilight ends; magenta. |
| -9 | `#3a3355` | 0.344 | 0.059 | 293 | Violet. |
| -12 | `#23233e` | 0.270 | 0.050 | 283 | Nautical ends. |
| -15 | `#17172a` | 0.215 | 0.037 | 283 | Night level. |
| -18 | `#0f1220` | 0.187 | 0.029 | 274 | |
| -25 | `#0c121e` | 0.183 | 0.026 | 264 | Floor. Ice stays clearly lighter than land at night, which is correct: snow is bright under starlight and moonlight, and it reads well on a dark map. |

#### 2.4.4 Step sizes

The consecutive OKLab distances (dE_ok) between stops are: ocean 0.005 to 0.023, land 0.008 to 0.068, ice 0.016 to 0.103. One dE_ok of 0.01 is roughly one to two just noticeable differences, so no two adjacent stops are more than about 10 JND apart and linear interpolation between them is smooth. The larger ice steps are at the terminator where the gradient is intentionally rapid.

### 2.5 The two term alternative, which I recommend for a physically derived look

Instead of one absolute ramp, decompose:

```
colour = albedo * directLight(h) * shadowFactor(h)  +  atmosphere(h)
```

- `albedo` comes from a Blue Marble texture (this is exactly what GeoColor V1.0 does: "the daytime background layer comes from the NASA MODIS Blue Marble").
- `directLight(h)` is result A in section 2.3, a 1D LUT of 16 entries. It is physical, it makes deserts go gold and forests go olive-bronze automatically, and it costs one texture fetch.
- `shadowFactor(h)` is a smooth 0 to 1 that reaches 0 at about -1 degree (the atmosphere at ground level is in shadow) with a penumbra of 0.53 degrees for the solar disc.
- `atmosphere(h)` is the path radiance term: blue on the day side, rotating violet then dying on the night side. It never multiplies the albedo, it always adds. This is what stops the terminator from ever going pure black and it is why all surfaces converge to the same blue grey near the terminator in result B.

This decomposition is both cheaper and more correct than three separate absolute ramps, and it gives you the ocean-versus-land difference for free, because it emerges from the albedo texture. The three absolute ramps above are then a useful cross check: sample your two term model over ocean, land and ice and it should land close to them.

### 2.6 GLSL for the ramp

```glsl
// 16 stop ramp evaluated in OKLab. Store the stops as OKLab (not sRGB) in a
// uniform array or a 1D texture so the interpolation is already perceptual.
// The elevation axis is non-uniform, so index by a monotone remap first.

const int N = 16;
uniform vec3  uRampOklab[N];   // L, a, b
uniform float uRampElev[N];    // +90 .. -25, strictly decreasing

// Non-uniform lookup. 16 iterations is fine; the compiler unrolls it and the
// branch is uniform across the whole warp except at 15 boundaries per screen.
vec3 sampleRamp(float elevDeg) {
    if (elevDeg >= uRampElev[0])     return uRampOklab[0];
    if (elevDeg <= uRampElev[N - 1]) return uRampOklab[N - 1];
    for (int i = 0; i < N - 1; ++i) {
        float a = uRampElev[i], b = uRampElev[i + 1];
        if (elevDeg <= a && elevDeg >= b) {
            float t = (a - elevDeg) / (a - b);
            t = t * t * (3.0 - 2.0 * t);         // smoothstep the segment
            return mix(uRampOklab[i], uRampOklab[i + 1], t);
        }
    }
    return uRampOklab[N - 1];
}
```

A 1D `RGBA16F` texture of 256 texels covering -25 to +90 with `LINEAR` filtering is faster and equally good: 115 degrees over 256 texels is 0.45 degrees per texel, well inside the smoothness of the underlying curves. Bake the OKLab values into the texture at startup, not sRGB.

---

## 3. How real products do it

### 3.1 CIRA GeoColor (the best documented, and worth copying)

Miller et al., "GeoColor: A Blending Technique for Satellite Imagery", J. Atmos. Oceanic Technol. 37, 429 (2020), https://rammb2.cira.colostate.edu/wp-content/uploads/2020/01/jtechd190134.pdf. This is the product you see on every US weather site. Quoting and paraphrasing the actual equations:

- **Day / night blend.** "The cosine of the solar zenith angle, mu_o = cos(theta_o), is then used as a dynamic blending factor between the two (dayside and nightside) stacked layers." mu_o is "normalized over the interval [0.1, 0.3]", and the normalised value is then raised to the power 1.5. In elevation terms **the fade runs from +17.46 degrees down to +5.74 degrees**, entirely on the daylit side of the terminator. The paper explains why: "a gradual fade into nighttime begins on the dayside of the terminator, with bounds selected experimentally based on matching to the observed dimming behavior of VIS imagery near the terminator (approximating twilight effects). The exponential term ... further approximates the observed nonlinear decrease of VIS reflectance near the terminator."
- **Day side background.** NASA MODIS Blue Marble, normalised to 0..1, then multiplied by a **dimming factor D = 0.75** "to improve the contrast of overlying VIS-layer features (e.g., clouds occurring over bright backgrounds such as deserts)".
- **Night side background.** A three layer stack: city lights on top, terrain relief in the middle, a base "nightscape" layer. The **city lights colour is literally `(L_R, L_G, L_B) = (1.0, 0.85, 0.0)`, which "simulates the amber color of sodium lighting"** (that is `#ffd900`, OKLCH L 0.891, C 0.183, H 96). The night land base is `(R_N, G_N, B_N) = (0.27, 0.12, 0.06)`. **Water is rendered pure black at night** via a land/sea mask premultiplier S.
- City lights come from a static database: OLS "Nighttime Lights of the World" 2003, 6 bit relative luminosity, normalised over the interval [10, 50].
- Clouds are composited as a white layer whose *transparency* is driven by scaled visible reflectance by day and by inverted IR brightness temperature by night.

**What to steal:** the cosine-of-solar-zenith blending weight, the power 1.5 to bend the curve, dimming the base map so overlays read, black ocean at night, and a hard land/sea mask on the night side elements.

**What not to steal:** GeoColor's fade completes at +5.7 degrees, so the whole of civil, nautical and astronomical twilight is simply "night". That is right for a meteorological product and wrong for a heliograph whose entire subject is the twilight gradient.

### 3.2 NASA Blue Marble and Blue Marble Next Generation

- BMNG is a monthly, global, **cloud free true colour** land cover picture at 500 m, from MODIS on Terra, 2004 data, produced by Reto Stockli (https://neo.gsfc.nasa.gov/view.php?datasetId=BlueMarbleNG). "The BMNG image RGB values are functionally related to spectral albedo for three MODIS visible wavelength channels."
- Crucially, **BMNG is an albedo product, not a picture of Earth at a moment.** It is cloud free, atmospherically corrected and sun angle normalised. That is exactly why it is the right base texture to multiply your `directLight(h)` against, and exactly why you must not treat it as "what the day side looks like".
- Ocean in the popular `land_shallow_topo` variants is not measured water leaving radiance: "the ocean color is derived from applying a depth shading to the bathymetry data". That is why my sample returned a synthetic `#0b0a32`.
- The Apollo 17 photograph is the honest reference for real ocean colour: `#03193e` to `#102a4e`.

### 3.3 NASA Black Marble

- Instrument: **VIIRS Day/Night Band, a panchromatic channel 0.5 to 0.9 micrometres**, 750 m, with high, medium and low gain stages covering over seven orders of magnitude (https://ntrs.nasa.gov/citations/20210011523). **There is no colour information.**
- The 2016 composite: 742 m per pixel, cloud free, "several months of processing to filter out clouds, moonlight, airglow, and other interfering features" (https://svs.gsfc.nasa.gov/30876/).
- **Night is defined by solar zenith angle.** Black Marble v1.0 used SZA > 108 degrees; v2.0 expanded to SZA > 102 degrees with a reduced quality flag between 102 and 108 (https://viirsland.gsfc.nasa.gov/PDF/BlackMarbleUserGuide_Collection2.0.pdf). Other DNB compositing work discards pixels with SZA below 101 degrees. In elevation terms: **-11 to -18 degrees**. Real satellite night light data does not exist above -11 degrees of solar elevation, so any city light you draw in civil twilight is an invention. That does not mean do not draw it; it means choose the fade deliberately (section 6.5).

### 3.4 timeanddate.com Day and Night World Map

Uses discrete shaded bands: day, three twilight steps, night (https://www.timeanddate.com/worldclock/sunearth.html). "The lightest shading represents daytime ... the darkest shading is nighttime ... the shadings between day and night are the three stages of twilight." It is a diagram, not a picture: no hue variation, no city lights, no chroma. It is legible and it is why it looks cheap. **The single change that most separates a beautiful heliograph from timeanddate is continuous hue rotation instead of three grey steps.**

in-the-sky.org's twilight map (https://in-the-sky.org/twilightmap.php) is the same idea with contour lines drawn at the twilight boundaries plus a subsolar point marker. Contour lines at exactly 0, -6, -12, -18 are a genuinely good optional overlay because they carry information the gradient cannot: they are hard, nameable thresholds.

### 3.5 earth.nullschool.net

Their About page (https://earth.nullschool.net/about.html) lists the stack (D3 for projection, GFS/OSCAR/WAVEWATCH data) and their colour scale sources: **ColorBrewer2, Kindlmann linear luminance, MYCARTA, and Dave Green's cubehelix**. Notably it contains **no mention of any day/night or solar shading at all.** What makes nullschool look expensive is therefore not twilight rendering, it is: perceptually uniform colour scales (Kindlmann and cubehelix are both explicitly designed for monotone luminance), a near black base map with hairline coastlines, a single accent colour for the reticle, and animated particle advection over a static, quiet background. **The lesson for the heliograph: choose perceptually uniform ramps, keep the cartography almost invisible, and let one thing move.**

### 3.6 shadowmap.org, Google Earth

- Shadowmap is a 3D sun and shadow analysis tool (https://app.shadowmap.org/) built on classic shadow mapping: render depth from the light with an orthographic projection for a directional sun, then compare. This is the right approach for terrain and buildings and irrelevant for a flat world map, where the shadow test is analytic (a dot product with the subsolar direction).
- Google Earth Studio: "renders a nighttime texture of the Earth with city lights, which fades out between 8000 km and 3000 km" altitude, and when the Sun is enabled "will simulate daylight, nighttime, dawn and dusk depending on your location and the time of day" (https://earth.google.com/studio/docs/advanced-features/special-attributes/). The altitude based fade of the city light layer is a good idea worth borrowing for a zoomable map: city lights are an appropriate abstraction at continental zoom and become wrong at city zoom.

### 3.7 Stellarium and Celestia

- Stellarium's legacy atmosphere is the **Preetham** analytic sky model for chromaticity with **Schaefer** for brightness. Their 0.22.0 release notes record adding "the ability to switch between Preetham and Schaefer for sky brightness (CIE Y channel), the ability to switch between 2 presets of chromaticity parameters (Preetham/Stellarium) ... and added an exponential twilight transition to Preetham zenith luminance" (https://stellarium.org/release/2022/03/27/stellarium-0.22.0.html). The telling detail is that **the twilight transition had to be bolted on**, because Preetham is only defined for a sun above the horizon.
- Zotti & Wilkie's critique of Preetham is the standard reference for where it breaks (https://www.cg.tuwien.ac.at/research/publications/2007/zotti-2007-wscg/zotti-2007-wscg-paper.pdf).
- Modern Stellarium offers **ShowMySky / CalcMySky**, a precomputed multiple scattering model, as the alternative (https://10110111.github.io/CalcMySky/using-in-stellarium.html). Hosek-Wilkie, the usual successor to Preetham, also "assume[s] the sun is above the horizon", with implementations "transitioning to a dark blue sky as the sun fully sets, and then to black towards the end of twilight". The 2021 to 2022 Prague spectral sky model is the one that actually supports a below-horizon sun.
- Celestia uses a separate night texture with the city lights masked to the dark side, and the community guidance is to use a levels adjustment "to adjust how far across the terminator you have the lights appear" (https://planetpixelemporium.com/tutorialpages/earthlight.html, and https://www.classe.cornell.edu/~seb/celestia/textures.html).

**Summary of what separates good from cheap:**

| Cheap | Good |
|---|---|
| Discrete twilight bands | Continuous ramp, but with optional contour lines at the four named thresholds |
| One hue darkened toward black | Hue rotation: cyan-blue day, violet twilight, warm airglow floor |
| Hard terminator | 0.53 degree penumbra plus a few degrees of atmospheric bleed |
| Multiplying the whole texture by a shadow factor | Multiply albedo by direct light, then *add* path radiance |
| City lights at full brightness the instant the sun sets | Fade in across several degrees, keyed to real DNB thresholds |
| sRGB lerp between stops | OKLab lerp plus dither |
| Ocean and land treated identically | Separate behaviour, because the physics differs (section 0, point 1) |

---

## 4. Perceptual technique

### 4.1 Which space to interpolate in

- **sRGB (gamma encoded) lerp.** Wrong for lightness (it lerps a perceptual-ish quantity, so it is not disastrous) but wrong for hue: mixing a saturated blue and a saturated orange in sRGB passes through a desaturated grey-brown. Terrible for the terminator, which is exactly a blue to orange transition.
- **Linear sRGB lerp.** Correct for physical light mixing (two lights added really do add in linear space) but perceptually wrong: the midpoint of black to white in linear sRGB is 0.5 linear = 0.735 sRGB = OKLab L 0.76, which reads far too light. Half your ramp is spent in the top quarter of perceived lightness.
- **OKLab / OKLCH lerp.** Ottosson's fits report RMS errors of 0.20 for lightness, 0.81 for chroma, 0.49 for hue across his datasets, "best among all spaces tested" for chroma (https://bottosson.github.io/posts/oklab/). Interpolating in OKLab keeps the midpoint at the perceptual midpoint and interpolating in OKLCH lets you *control* the hue path instead of accepting whatever line crosses the ab plane.

**Recommendation:** design and store the ramp in OKLCH, bake it to OKLab, lerp in OKLab in the shader, convert to linear sRGB once per pixel, encode. Do not lerp in OKLCH in the shader: the hue angle needs wrapping logic and you already chose the hue path when you authored the stops.

**Caution:** "linear encoding in Oklab can produce colors more colorful than physically possible" (https://bottosson.github.io/posts/gamutclipping/). Interpolating between two in-gamut stops can leave the sRGB gamut. My ramp generator checks for this by bisecting chroma toward the achromatic axis until the colour is in gamut; every stop above is in gamut, and every straight OKLab segment between adjacent stops is too, because the segments are short. If you author new stops, re-check.

### 4.2 GLSL: sRGB and OKLab, both directions

**These matrices matter and one of them is very commonly mistyped.** The (2,3) element of the OKLab-to-linear-sRGB matrix is **-0.3413193965**, not -0.4413. I verified this two ways: by fetching the raw HTML of Ottosson's post, and by numerically inverting the forward matrix (`numpy.linalg.inv` of the linear-sRGB-to-LMS matrix returns exactly `[-1.268438, 2.6097574, -0.3413194]` in row 2). A -0.44 will silently break your round trip by about 0.02 in L and 7 degrees in hue, which looks like "the ramp is slightly off" rather than an obvious bug.

```glsl
// ---- sRGB transfer function (IEC 61966-2-1) ----
vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92,
               pow((c + 0.055) / 1.055, vec3(2.4)),
               step(vec3(0.04045), c));
}
vec3 linearToSrgb(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(c * 12.92,
               1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
               step(vec3(0.0031308), c));
}

// ---- Oklab, Bjorn Ottosson, matrices updated 2021-01-25 ----
// https://bottosson.github.io/posts/oklab/   (public domain / MIT)
vec3 linearSrgbToOklab(vec3 c) {
    float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
    float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
    float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
    float l_ = pow(l, 1.0 / 3.0);
    float m_ = pow(m, 1.0 / 3.0);
    float s_ = pow(s, 1.0 / 3.0);
    return vec3(
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_);
}

vec3 oklabToLinearSrgb(vec3 c) {
    float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
    float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
    float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;
    return vec3(
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,   // <-- 0.3413, not 0.4413
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}

// pow() with a negative base is undefined in GLSL. If any input can be
// negative (it can, if you feed back unclamped HDR), use:
//   float cbrt(float x) { return sign(x) * pow(abs(x), 1.0/3.0); }
```

`pow(x, 1.0/3.0)` costs a log2, a multiply and an exp2 on most hardware, so `linearSrgbToOklab` is about 3 transcendentals. For a full screen pass at 4K that is measurable but fine. You only need the *inverse* direction per pixel if you store the ramp in OKLab, which is the recommendation.

### 4.3 A useful helper: OKLCH to hex on the CPU

Author the ramp with this (Python, mirrors the GLSL exactly), and re-run it whenever you change a stop:

```python
import math

def oklab_to_lin(L, a, b):
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    return (+4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
            -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
            -0.0041960863*l - 0.7034186147*m + 1.7076147010*s)

def lin_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 12.92*c if c <= 0.0031308 else 1.055*c**(1/2.4) - 0.055

def oklch_to_hex(L, C, H):
    a, b = C*math.cos(math.radians(H)), C*math.sin(math.radians(H))
    rgb = oklab_to_lin(L, a, b)
    if min(rgb) < 0 or max(rgb) > 1:            # bisect chroma back into gamut
        lo, hi = 0.0, 1.0
        for _ in range(40):
            t = (lo + hi) / 2
            r = oklab_to_lin(L, a*t, b*t)
            lo, hi = (lo, t) if (min(r) < 0 or max(r) > 1) else (t, hi)
        rgb = oklab_to_lin(L, a*lo, b*lo)
    return '#%02x%02x%02x' % tuple(round(255*lin_to_srgb(c)) for c in rgb)
```

### 4.4 Avoiding muddy or grey midpoints

Three distinct failure modes, with the fix for each:

1. **Chroma collapse at the crossover.** If the ramp goes warm at +2 and cool at -2 and you interpolate the a and b coordinates linearly, the segment passes near a = b = 0 and the midpoint is grey. **Fix:** insert a stop at the crossover with the chroma you want (the LAND ramp holds C = 0.092 at 0 degrees and 0.092 at -2, rotating hue from 53 to 40 rather than passing through zero chroma). Alternatively interpolate that one segment in OKLCH with an explicit hue path.
2. **Physically honest desaturation.** The Himawari data show clear ocean chroma falling from 0.068 at +50 to 0.015 at +5. That is real, and it is why a strictly physical ramp looks washed out near the terminator. My ocean ramp deliberately holds C at 0.055 to 0.064 through that region. This is a **DESIGN JUDGEMENT** and it is the main place where the ramp departs from measurement. If you want documentary accuracy, drop the chroma; if you want the map to look alive, hold it.
3. **Hue path curvature.** Going from OKLCH hue 53 (orange) to 283 (violet) the short way passes through 0, 330, 300, which is red then magenta then violet. That is the correct path and it happens to reproduce the Belt of Venus and purple light. Going the long way, 53 to 100 to 180 to 283, would pass through green and cyan and would look like a bug. The LAND and ICE ramps above pin intermediate hues at -2, -4, -6 and -9 precisely to force the short path.

### 4.5 Banding, and the dither that fixes it

**The arithmetic.** The ocean ramp spans OKLab L from 0.345 to 0.111. Expressed in 8 bit sRGB the blue channel runs from 0x61 (97) to 0x0e (14): about 83 distinct levels. On a 2560 px wide map with the terminator crossing diagonally, the gradient is spread over roughly 1200 px, so each 8 bit step occupies about 14 px. A 14 px wide flat band with a hard 1/255 edge is *plainly visible*. You must dither.

**Amplitude.** For 8 bit output, add noise with a peak to peak amplitude of one quantisation step, centred on zero, i.e. the range [-0.5/255, +0.5/255] for uniform noise. This is the amplitude used by the reference implementation at https://blog.frost.kiwi/GLSL-noise-and-radial-gradient/: "This adds noise in the range [-0.5/255, 0.5/255] to keep average brightness unchanged."

For **triangular (TPDF)** noise, formed as the difference of two uniform samples, the standard result is that you need roughly twice the amplitude of uniform noise to fully decorrelate the quantisation error, so the range becomes [-1/255, +1/255]. Bart Wronski's analysis (https://bartwronski.com/2016/10/30/dithering-part-three-real-world-2d-quantization-dithering/) shows uniform noise leaves "bands of unchanged values in smooth gradients" that TPDF removes. He also flags the edge case: near black and near white, TPDF at that amplitude lifts blacks by about 20 percent of a quantisation step, which for a night-side map matters. Clamp or taper the dither in the darkest 2 or 3 levels.

For **10 bit** output, divide by four: [-0.5/1023, +0.5/1023].

**Interleaved gradient noise (recommended default).** Jorge Jimenez, "Next Generation Post Processing in Call of Duty: Advanced Warfare", SIGGRAPH 2014 (https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/). The constants are not arbitrary and must not be rounded.

```glsl
float interleavedGradientNoise(vec2 fragCoord) {
    return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));
}

// apply immediately before writing, in the *output* (sRGB encoded) domain
vec3 dither8(vec3 srgbColour, vec2 fragCoord) {
    float n = interleavedGradientNoise(fragCoord);
    return srgbColour + (n - 0.5) * (1.0 / 255.0);
}
```

Wronski describes IGN as producing "much more pleasant patterns" than Bayer at minimal cost, and it is "halfway between dithered and random" with blue-noise-like characteristics.

**Ordered Bayer (cheapest, visible pattern).** Bayer 4x4, threshold matrix over 16 levels:

```glsl
// standard 4x4 Bayer, values 0..15
float bayer4(ivec2 p) {
    const int m[16] = int[16]( 0,  8,  2, 10,
                              12,  4, 14,  6,
                               3, 11,  1,  9,
                              15,  7, 13,  5);
    return float(m[(p.y & 3) * 4 + (p.x & 3)]) / 16.0;   // in [0, 15/16]
}
vec3 ditherBayer(vec3 srgbColour, vec2 fragCoord) {
    float d = bayer4(ivec2(fragCoord)) - 0.5 + 1.0 / 32.0;  // zero mean
    return srgbColour + d * (1.0 / 255.0);
}
```

The 8x8 matrix is generated by the standard recurrence `M_{2n} = [[4M_n, 4M_n+2],[4M_n+3, 4M_n+1]]`. Use it if you use Bayer at all, because the 4x4 crosshatch is visible on a big flat gradient. Wronski's verdict is blunt: Bayer matrices "produce very visible unpleasant patterns" and should be avoided in new code. On a slowly animating map (you are scrubbing time) a static Bayer pattern is *especially* bad because the pattern stays put while the image moves under it.

**Blue noise (best quality).** Precompute or embed a 64x64 or 128x128 R8 tile, sample with `texelFetch(blueNoise, ivec2(fragCoord) & 63, 0)`, and remap to TPDF:

```glsl
uniform sampler2D uBlueNoise;    // 64x64 R8, values 0..1, tiled
uniform float uFrame;            // frame counter, for temporal animation

float triangularRemap(float u) {   // uniform [0,1) -> triangular [-1,1]
    u = u * 2.0 - 1.0;
    return sign(u) * (1.0 - sqrt(max(0.0, 1.0 - abs(u))));
}

vec3 ditherBlueNoiseTPDF(vec3 srgbColour, vec2 fragCoord) {
    float u = texelFetch(uBlueNoise, ivec2(fragCoord) & 63, 0).r;
    // golden ratio offset animates the tile without introducing low frequencies
    u = fract(u + 0.61803398875 * uFrame);
    float t = triangularRemap(u);                 // [-1, 1]
    return srgbColour + t * (1.0 / 255.0);        // TPDF wants 2x uniform amplitude
}
```

The golden ratio temporal offset is Wronski's "dithering part two" trick (https://bartwronski.com/2016/10/30/dithering-part-two-golden-ratio-sequence-blue-noise-and-highpass-and-remap/). Blue noise tiles can be generated offline with https://github.com/bartwronski/BlueNoiseGenerator. Since the app must make **zero external network requests at runtime**, embed the tile as a base64 PNG in the bundle or generate it at build time; do not fetch it.

**One hazard, from the frost.kiwi article:** on 6 bit panels that do their own internal dithering, adding 8 bit dither creates interference patterns. There is no fix, only awareness.

### 4.6 Gamma, linear blending, and tone mapping

- **Do the ramp lookup and the OKLab lerp in OKLab, do any *additive* compositing in linear sRGB, and encode to sRGB exactly once, at the very end.** City lights, glint, bloom and aurora are all additive light and must be added in linear space. Adding them in sRGB space makes them look chalky over dark backgrounds and makes them saturate too early over bright ones.
- In WebGL2, either use a plain `RGBA8` default framebuffer and encode manually with the function above (recommended: you keep control of exactly where the dither happens relative to encoding), or attach an `SRGB8_ALPHA8` renderbuffer and let the hardware encode (but then you cannot dither in the encoded domain, and the hardware encode happens *after* blending, which is what you want for blending but complicates dithering). **Manual encode plus manual dither is the simpler mental model and is what I recommend.**
- **Tone mapping: no, with one exception.** The ramp is already an authored, bounded, low dynamic range curve; running ACES or Reinhard over it will desaturate the deep blues and lift the night floor, undoing your work. The exception is if you add strong bloom and glint, whose peaks legitimately exceed 1.0. In that case apply a *very* gentle roll-off to highlights only, for example
  ```glsl
  // gentle shoulder: identity below 0.8, asymptotes to 1.0
  vec3 shoulder(vec3 c) {
      const float k = 0.8;
      return mix(c, k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k))), step(vec3(k), c));
  }
  ```
  and leave everything below 0.8 untouched. **UNVERIFIED / DESIGN JUDGEMENT:** this specific curve is mine, not from a source; it is just a soft exponential knee.
- Do not apply an sRGB "gamma 2.2" approximation anywhere. The piecewise sRGB function differs from pure 2.2 by up to 0.02 in the near-black region, which is precisely the region your whole night side lives in.

---

## 5. Bloom and glow

### 5.1 Terminator light bleed

There are two separate reasons the terminator is soft, and both have real magnitudes:

1. **Solar disc penumbra:** 0.5334 degrees of angular diameter means the geometric terminator is a 0.53 degree wide band, about 59 km on the ground.
2. **Atmospheric height:** the shadow height table in section 1.2 says the air at 15 km is still lit when the ground is at -4 degrees, and the air at 35 km is still lit at -6 degrees. A satellite looking down at a point at -4 degrees sees a column that is dark at the bottom and sunlit at the top, so the pixel is not dark. **This is not bloom, it is the ramp**, and my ramp already encodes it (ocean at -4 is still L 0.19).

What bloom adds on top of those is the perceptual cue that the day side is *bright*. A cheap and effective single pass:

```glsl
// Full screen pass. sceneTex is the composited map in LINEAR space.
// Bleeds light from the bright side of the terminator into the dark side by
// sampling along the local gradient of the solar elevation field.
uniform sampler2D uScene;      // linear
uniform sampler2D uElev;       // R16F, solar elevation in degrees, same res
uniform vec2 uTexel;

vec3 terminatorBleed(vec2 uv) {
    float e  = texture(uElev, uv).r;
    // only act in a band around the terminator
    float band = exp(-pow((e + 3.0) / 7.0, 2.0));       // peaks at e = -3
    if (band < 0.01) return vec3(0.0);

    // gradient of the elevation field points toward the sunlit side
    float ex = texture(uElev, uv + vec2(uTexel.x, 0)).r
             - texture(uElev, uv - vec2(uTexel.x, 0)).r;
    float ey = texture(uElev, uv + vec2(0, uTexel.y)).r
             - texture(uElev, uv - vec2(0, uTexel.y)).r;
    vec2 dir = normalize(vec2(ex, ey) + 1e-6);

    // 8 taps marching toward the light, gaussian weighted
    const int N = 8;
    vec3 sum = vec3(0.0);
    float wsum = 0.0;
    for (int i = 1; i <= N; ++i) {
        float t = float(i) / float(N);
        float w = exp(-3.0 * t * t);
        sum  += texture(uScene, uv + dir * uTexel * (t * 48.0)).rgb * w;
        wsum += w;
    }
    return (sum / wsum) * band * 0.25;                  // additive, linear space
}
```

Cost: 8 taps plus 4 for the gradient. It is directional rather than isotropic, which is what you want: light should bleed *across* the terminator, not smear along it. **UNVERIFIED / DESIGN JUDGEMENT:** the 48 texel reach, the 0.25 gain and the Gaussian band centred at -3 degrees are mine and want tuning. Everything about the shape is motivated by the shadow height physics above.

If you want a proper HDR bloom instead, use the Call of Duty pyramid (Jimenez 2014), documented with full GLSL at https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom:

- **Downsample: 13 tap.** Weights are centre 0.125; the four "inner" samples at half-texel diagonals 0.125 each; the four edge samples 0.0625 each; the four corner samples 0.03125 each. Sums to 1.0.
- **Upsample: 9 tap tent**, weights `1/16 * [[1,2,1],[2,4,2],[1,2,1]]`.
- Combine progressively: `D' = D + blur(E')`, then `C' = C + blur(D')`, and so on up the chain, then `mix(fullRes, A', bloomStrength)` with bloomStrength "typically 0.03 to 0.15".

Five or six mips is enough for a full screen map. This is more expensive than the single pass above but temporally stable, which matters when you are animating a whole year.

### 5.2 Specular sun glint on the ocean

**The physics.** Water has refractive index n = 1.33, so normal incidence reflectance is

```
F0 = ((n - 1) / (n + 1))^2 = (0.33 / 2.33)^2 = 0.0201
```

Use F0 = 0.02 (this is the standard dielectric value; see for example https://docs.omniverse.nvidia.com/materials-and-rendering/latest/templates/parameters/OmniSurface_Specular.html which notes F0 "normally falls between 0.03 and 0.06 for dielectric materials", with water at the low end).

**The roughness.** Cox & Munk (1954) measured sea surface slope statistics from photographs of the sun's glitter. From the Ocean Optics Web Book (https://www.oceanopticsbook.info/view/surfaces/cox-munk-sea-surface-slope-statistics), quoting the three fits with U the wind speed in m/s at 12.5 m:

```
sigma_a^2 = 0.000 + 3.16e-3 * U   +/- 0.004    (along wind,  r = 0.945)
sigma_c^2 = 0.003 + 1.92e-3 * U   +/- 0.002    (cross wind,  r = 0.956)
sigma^2   = 0.003 + 5.12e-3 * U   +/- 0.004    (total,       r = 0.986)
```

Converting to a microfacet roughness (my calculation): the total mean square slope sigma^2 is the variance of the surface slope, and for a Beckmann or GGX distribution the parameter alpha is the RMS slope. Therefore

| Wind speed | sigma^2 | RMS slope = alpha | UE4-style roughness = sqrt(alpha) |
|---|---|---|---|
| 0 m/s (glassy) | 0.003 | 0.055 | 0.23 |
| 3 m/s (light breeze) | 0.018 | 0.135 | 0.37 |
| 7 m/s (moderate) | 0.039 | 0.197 | 0.44 |
| 10 m/s (fresh) | 0.054 | 0.233 | 0.48 |
| 14 m/s | 0.075 | 0.273 | 0.52 |

Cox & Munk's own headline number is that the mean square slope reaches (tan 16 deg)^2 at 14 m/s, i.e. RMS slope 0.287, which agrees with the table to within 5 percent. **Use alpha = 0.20 as the default** (moderate 7 m/s wind); it gives a glitter path a few degrees wide, which is what you see from orbit.

**GLSL, Cook-Torrance GGX, suitable for a full screen pass on a flat map.** On an equirectangular map the view direction is nadir everywhere and the surface normal is the local up, so the geometry collapses beautifully: the half vector between the nadir view and the sun is fixed by the solar elevation alone, and `N.H = cos(theta_s / 2)` where theta_s is the solar zenith angle. In other words **the glint is a pure function of solar elevation**, exactly like the ramp.

```glsl
// h  = solar elevation in degrees at this pixel
// isOcean = 1.0 over water
float ggxGlint(float hDeg, float alpha) {
    // nadir view: V = up. Sun at zenith angle tz = 90 - h.
    float tz = radians(90.0 - hDeg);
    if (tz >= radians(90.0)) return 0.0;              // sun below horizon
    float cosTz = cos(tz);

    // half vector between V=(0,0,1) and L=(sin tz, 0, cos tz)
    // N.H = cos(tz/2), and the angle between N and H is tz/2
    float thetaH = 0.5 * tz;
    float NdotH  = cos(thetaH);
    float NdotL  = cosTz;
    float NdotV  = 1.0;

    // GGX / Trowbridge-Reitz normal distribution
    float a2 = alpha * alpha;
    float d  = NdotH * NdotH * (a2 - 1.0) + 1.0;
    float D  = a2 / (3.14159265 * d * d);

    // Smith height-correlated visibility (Heitz), already divided by 4 NdotL NdotV
    float lv = NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2);
    float ll = NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2);
    float Vis = 0.5 / max(lv + ll, 1e-5);

    // Schlick Fresnel on the half angle
    float F0 = 0.02;
    float F  = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

    return D * Vis * F * NdotL;
}
```

Sanity check on the shape: with alpha = 0.20, `D` falls to half its peak when `thetaH` reaches about `alpha / 2` in radians, i.e. 5.7 degrees, so the half-power point is at solar zenith 11.5 degrees, i.e. solar elevation 78.5 degrees. **The glint therefore occupies a patch roughly 20 to 25 degrees of arc across centred on the subsolar point**, which is about 2500 km wide, which is what MODIS and Himawari glint patches actually look like. Good.

The Fresnel term is nearly constant here (NdotH is close to 1 across the whole glint) so a **cheap Blinn-Phong stand-in is perfectly adequate**:

```glsl
// Blinn-Phong stand-in. exponent n relates to GGX alpha as n ~ 2/alpha^2 - 2
// alpha 0.20 -> n = 48;  alpha 0.14 -> n = 100;  alpha 0.10 -> n = 198
float glintCheap(float hDeg, float n) {
    float tz = radians(90.0 - hDeg);
    if (tz >= radians(90.0)) return 0.0;
    return pow(max(cos(0.5 * tz), 0.0), n) * cos(tz) * 0.02;   // 0.02 = F0
}
```

Composite it **additively in linear space**, tinted with the direct beam colour from section 2.3 result A (at the subsolar point that is `#fff9eb`, essentially white). Mask it to ocean. Give it a very slight bloom so it reads as a highlight rather than a disc. **DESIGN JUDGEMENT:** in practice you will want to lower the physical F0 contribution because a photometrically correct glint at 2 percent reflectance is barely visible against a Blue Marble ocean at 3 to 7 percent; multiplying the glint by 4 to 8 is a defensible cheat, and it is exactly what every satellite "true colour" product does implicitly by contrast stretching.

---

## 6. City lights on the night side

### 6.1 Why Black Marble looks like Black Marble

Two things, and neither is the dots.

- **Dynamic range.** The DNB covers over seven orders of magnitude. The published image is a strong non-linear stretch of that. In my sample of the 0.1 degree composite, city cores clip to 255 while the surrounding suburbs sit at 60 to 150 and the countryside at 15 to 35. It is the *long tail*, not the bright cores, that makes it read as a settlement pattern rather than a starfield.
- **Spatial structure.** Real lights are a mix of point sources (isolated towns), lines (roads, coasts, the Nile, the Trans-Siberian) and sheets (the Ruhr, the BosWash corridor, the Ganges plain). The Tokyo radial profile falls from 250 to 68 in 6 pixels; the Cairo profile only falls from 253 to 108 in the same distance, because it is a delta not a city. If you synthesise lights from a population point dataset you must add the linear and areal structure or it will look like a star chart.

### 6.2 Brightness and size versus population

The empirical relationship between night-time light radiance and population is roughly a power law. **UNVERIFIED as a precise exponent** in what I could fetch, but the practical rendering rule that reproduces the Black Marble look is:

```
coreRadius(pop)     = r0 * pow(pop / 1e6, 1/3)        // area ~ pop^(2/3), a city footprint
peakBrightness(pop) = b0 * pow(pop / 1e6, 0.25)       // strongly compressed
haloRadius(pop)     = 3.5 * coreRadius(pop)
haloBrightness      = 0.06 * peakBrightness
```

The 1/3 exponent on radius comes from urban area scaling roughly with population to the two-thirds power; the 0.25 exponent on brightness is a compression that keeps Tokyo from being ten thousand times brighter than Reykjavik. Both of these are **DESIGN JUDGEMENT**, tuned to reproduce the measured Tokyo profile (250, 216, 147, 68, 42, 33, 20 at r = 0, 2, 4, 6, 8, 10, 12 pixels of 11 km).

### 6.3 The glow kernel

The measured Tokyo profile is fitted well by a sum of two Gaussians, a tight core and a wide low halo:

```glsl
// r in units of coreRadius
float cityKernel(float r) {
    float core = exp(-2.30 * r * r);          // half at r = 0.55
    float halo = 0.07 * exp(-0.09 * r * r);   // half at r = 2.8
    return core + halo;
}
```

Check against the data (my fit): normalised to 1.0 at r = 0 with coreRadius = 3.6 px for Tokyo, this gives 0.86, 0.55, 0.26, 0.13, 0.09, 0.06 at r = 2, 4, 6, 8, 10, 12 px versus the measured 0.86, 0.59, 0.27, 0.17, 0.13, 0.08. Close enough.

Render the lights into an offscreen `R16F` or `RGBA16F` accumulation buffer with **additive blending** (`glBlendFunc(GL_ONE, GL_ONE)`), as point sprites or instanced quads sized to `haloRadius`, then composite that buffer additively over the map in **linear** space. Additive is essential: two adjacent cities in the Ruhr must sum into a continuous sheet, which is exactly what the real data does.

If you use the Black Marble texture directly rather than synthesising, the same rule applies: sample it, convert from sRGB to linear, multiply by your colour and fade, add.

### 6.4 Colour temperature: sodium versus LED

- **High pressure sodium**, the classic orange street light: CCT 1900 to 2200 K, "approximately 2000 K" (https://www.accessfixtures.com/leds-that-look-like-hps/).
- **Outdoor LED**, the replacement: "LEDs typically used in outdoor applications may have a CCT of about 4000 K and CRI of about 70", with "relatively high short-wavelength (blue) spectral content".
- The transition is visible from orbit. Milan converted fully to white LED in 2015 and ESA published the before/after ISS photographs, colour calibrated by the European Astronomical Society (https://www.esa.int/ESA_Multimedia/Images/2022/10/Milan_at_night_A_decade_of_changes_in_street_lighting). "Milan was the first city in Europe to do a total conversion of its street lighting to white LEDs."
- Because the DNB is panchromatic, only human-camera imagery (ISS astronaut photography, the "Cities at Night" project) carries real colour.

**Planckian colours I computed** using the ASTM G-173 white point, the Wyman CMF fits and the standard sRGB matrix, normalised so the maximum channel is 1.0:

| CCT | Linear RGB | Hex | OKLCH |
|---|---|---|---|
| 1800 K | 1.000, 0.219, 0.000 | `#ff8100` | L 0.733, C 0.185, H 53 |
| **2000 K (HPS)** | 1.000, 0.267, 0.008 | **`#ff8d15`** | L 0.753, C 0.176, H 58 |
| 2200 K | 1.000, 0.314, 0.028 | `#ff982f` | L 0.772, C 0.165, H 60 |
| 2700 K (warm LED) | 1.000, 0.424, 0.100 | `#ffae59` | L 0.814, C 0.138, H 65 |
| 3000 K | 1.000, 0.485, 0.155 | `#ffb96e` | L 0.836, C 0.123, H 67 |
| **4000 K (typical outdoor LED)** | 1.000, 0.661, 0.379 | **`#ffd4a6`** | L 0.896, C 0.077, H 69 |
| 5000 K | 1.000, 0.797, 0.630 | `#ffe7d0` | L 0.941, C 0.040, H 66 |
| 6500 K | 1.000, 0.947, 0.993 | `#fff9fe` | L 0.988, C 0.009 |

Note that HPS is *not* a blackbody (it is a pressure-broadened sodium doublet), so its real chromaticity is slightly more saturated and slightly greener than the 2000 K Planckian; `#ff8d15` is a good practical stand-in, and CIRA's own hand-picked "amber sodium" is `(1.0, 0.85, 0.0)` = `#ffd900`, considerably more yellow. Pick from that range.

**Recommendation.** Do not use one colour. Mix two populations per light source, warm `#ffb26b` and cool `#e8eeff`, with the mix fraction varying by region (a per-city or per-country parameter, or simply a low frequency noise field). The measured aggregate of all bright Black Marble pixels is `#dacbb0`, linear 1.00 : 0.93 : 0.81, which is what a warm-dominated mixture looks like once cores clip. Target that aggregate. Also add a small **gas flare** class in pure orange (`#ff7b28`, **UNVERIFIED**) for the Persian Gulf, the Niger delta, the Bakken and western Siberia, which are unmistakable in the real imagery and are a lovely detail.

### 6.5 When to fade in and out

Constraints from real products:

- Black Marble v2.0 accepts data only for solar zenith angle > 102 degrees, i.e. **solar elevation below -12**; v1.0 required > 108 degrees, i.e. below -18. Other DNB compositing discards SZA < 101 degrees, i.e. above -11.
- GeoColor's night-side stack (which carries the city lights) reaches full weight at cos(SZA) = 0.1, i.e. **solar elevation +5.74**, and is fully absent above +17.46. That is far too early for our purposes but shows how tolerant viewers are.
- Physically: at what elevation does a city outshine the sky? The sky luminance from Patat is 0.51 cd/m2 at -6 and 0.048 at -8. A brightly lit urban surface at night is of order 1 to 10 cd/m2 as seen from the ground, but as *upwelling radiance seen from space* it is far dimmer; the crossover in practice is around -6 to -8 degrees, which is why photographers shoot cityscapes during blue hour.

**Recommended fade (DESIGN JUDGEMENT, anchored on the above):**

```glsl
// 0 at and above -3 deg, 1 at and below -10 deg
float cityLightFade(float hDeg) {
    return smoothstep(-3.0, -10.0, hDeg);
}
```

- Nothing above -3 degrees: the sky is far too bright, and lights appearing at sunset looks wrong.
- Half strength at about -6.5, the end of civil twilight, matching the blue hour intuition.
- Full by -10, comfortably before the -11 to -12 threshold at which real DNB data exists.
- Because you are animating time, use `smoothstep` and not a step; a hard on/off will strobe across the map as you scrub.

Optionally scale the fade by the local light's brightness so that the biggest megacities appear a degree or two earlier than small towns. That is physically right (brighter source beats the twilight sky sooner) and it looks great as the terminator sweeps across a continent.

---

## 7. Atmosphere on a flat equirectangular map

A sphere gets its atmosphere for free from the limb: you compute `1 - dot(N, V)`, the rim lights up, done. **An equirectangular map has no limb.** Every pixel is a nadir view. So you have to synthesise the three things the limb was doing for you:

### 7.1 The blue path radiance over the day side

This is the `atmosphere(h)` additive term of section 2.5, and it is genuinely single scattering, evaluated analytically. For a nadir view of a plane parallel atmosphere the single scattering reflectance is

```
rho_path(lambda) = [ tau_R * P_R(Theta) + ssa_M * tau_M * P_M(Theta) ] / 4
                   * ( 1 - exp( -tau_e * (m_s + 1) ) ) / tau_e
```

with `m_s` the Kasten-Young air mass, `Theta` the scattering angle (for nadir view `cos Theta = -sin h`), `P_R(Theta) = 0.75 * (1 + cos^2 Theta)`, and `P_M` the Henyey-Greenstein phase with g = 0.8. That is three RGB constants and two exponentials. Sanity check at 550 nm with the sun overhead: `tau_R = 0.0973`, `P_R = 1.5`, gives rho = 0.033, and at 440 nm `tau_R = 0.2648` gives rho = 0.077. Those are the correct TOA Rayleigh reflectances over a dark surface, and the 2.3x blue-to-green ratio is exactly why the ocean looks navy from space rather than black.

Precompute this into your 1D elevation LUT rather than evaluating it per pixel. Three RGB channels, 256 entries. You already need the LUT for the ramp.

### 7.2 The bleed across the terminator

Covered in section 5.1. The key physical input is the shadow height table: the ramp should not reach the night floor until about -16, and the *reason* is that the upper atmosphere is still lit. That is not a hack, it is the whole phenomenon.

### 7.3 A limb rim, if the projection has one

If you offer an orthographic or globe view alongside the equirectangular one, then and only then do you want the classic rim:

```glsl
// N = surface normal, V = view direction, L = sun direction
float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
// Rayleigh tint: relative extinction at 680, 550, 440 nm from Bruneton & Neyret
const vec3 kRayleigh = vec3(5.8e-6, 13.5e-6, 33.1e-6);
vec3 rimColour = normalize(kRayleigh) * rim * max(dot(N, L) + 0.35, 0.0);
```

The `(5.8, 13.5, 33.1) x 10^-6 m^-1` for `(680, 550, 440) nm` figures are Bruneton & Neyret, "Precomputed Atmospheric Scattering", CGF 27(4), 2008 (https://inria.hal.science/inria-00288758/file/article.pdf). The `+0.35` in the last term is what makes the rim wrap past the terminator, and 0.35 corresponds to about 20 degrees of wrap, which is the right order given the shadow height table. **DESIGN JUDGEMENT** on the exponent 3 and the 0.35.

### 7.4 What you do not need

Do not build a full Bruneton or Nishita multiple scattering LUT for a flat map. The entire angular dependence collapses to one variable, solar elevation, so a 256 entry 1D table computed at startup in JavaScript with the constants in section 2.3 is exact for the model and costs nothing. This is the single biggest architectural win available: **the physics is one dimensional here.**

---

## 8. Consolidated numbers

| Quantity | Value | Source |
|---|---|---|
| Sunrise/sunset geometric elevation | -0.8333 deg (50 arcmin: 16 semi-diameter + 34 refraction) | USNO |
| Civil / nautical / astronomical twilight | -6 / -12 / -18 deg | USNO |
| Solar angular diameter | 0.5334 deg, 59 km terminator penumbra | standard |
| Night sky level actually reached at | -15 to -16 deg | Patat et al. 2006 |
| Purple light peak purity | -3.89 deg | Lee & Hernandez-Andres 2003 |
| Belt of Venus | 10 to 20 deg above antisolar horizon, civil twilight | Wikipedia; Lee & Hernandez-Andres 2015 |
| Twilight chroma maximum | -8 deg, OKLCH hue 276.6 | my derivation from Patat Table 1 |
| Sky luminance at -6 / -10 / -15 deg | 0.51 / 6.8e-3 / 3.2e-4 cd/m2 | my calculation from Patat Table 1 |
| Dark sky floor | 21.6 to 22.0 mag/arcsec2, 1.7 to 2.5e-4 cd/m2 | Patat 2003; hnsky.org |
| Scotopic / mesopic / photopic | below 1e-3 / 1e-3 to 3 / above 3 cd/m2 | rp-photonics |
| Full daylight | 120,000 lux; sunrise/sunset 400 lux; full moon 0.25 lux; starlight + airglow 0.002 lux | Wikipedia "Daylight" |
| Earth Bond albedo | 0.30 | BBSO Earthshine |
| Airglow green line | 557.7 nm, about 20 percent of visible night sky light | NPS Night Skies |
| Rayleigh vertical optical depth at 550 nm | 0.0973 | my calculation from Bruneton constants |
| Rayleigh extinction at 680/550/440 nm | 5.8 / 13.5 / 33.1 e-6 m^-1 | Bruneton & Neyret 2008 |
| Rayleigh scale height / Mie scale height | 8000 m / 1200 m | Bruneton demo.cc |
| Mie asymmetry g | 0.8 (Bruneton); GPU Gems 2 says "usually between -0.75 and -0.999", never exactly +/-1 | Bruneton; O'Neil GPU Gems 2 ch.16 |
| Ozone column used | 300 DU, 1 DU = 2.687e20 molecules m^-2 | Bruneton demo.cc |
| Water F0 | 0.0201 for n = 1.33 | my calculation |
| Ocean slope variance | sigma^2 = 0.003 + 5.12e-3 * U (U in m/s) | Cox & Munk 1954 via Ocean Optics Web Book |
| Recommended ocean GGX alpha | 0.20 (7 m/s wind) | my calculation from Cox & Munk |
| GeoColor terminator blend | cos(SZA) normalised over [0.1, 0.3] then ^1.5, i.e. elevation +17.46 to +5.74 | Miller et al. 2020 |
| GeoColor sodium colour / night land base / Blue Marble dimming | (1.0, 0.85, 0.0) / (0.27, 0.12, 0.06) / D = 0.75 | Miller et al. 2020 |
| VIIRS DNB band | panchromatic 0.5 to 0.9 micrometres, 750 m, >7 decades dynamic range | NASA/NOAA |
| Black Marble night threshold | SZA > 102 deg (v2.0), > 108 deg (v1.0) | Black Marble User Guide C2.0 |
| HPS / outdoor LED CCT | 1900 to 2200 K / about 4000 K | AccessFixtures; VIIRS literature |
| 8 bit dither amplitude | uniform +/-0.5/255, TPDF +/-1/255 | frost.kiwi; Wronski |
| Interleaved gradient noise | `fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))))` | Jimenez 2014 |
| Oklab inverse matrix element (2,3) | **-0.3413193965** | Ottosson, verified by numerical inversion |
| Bloom pyramid | 13-tap down, 9-tap tent up, strength 0.03 to 0.15 | Jimenez 2014 / LearnOpenGL |

---

## 9. Open questions and things I could not verify

1. **Exact power law for night light radiance versus population.** I have the empirical Tokyo/Cairo/Chicago radial profiles and a working two-Gaussian fit, but I could not fetch a peer reviewed exponent for radiance versus population. If you synthesise lights from a population dataset rather than using a Black Marble texture, this is worth 20 minutes of literature search.
2. **Absolute lightness calibration of the NICT Himawari product.** Cloud tops top out at `#a9b4ca` rather than near white, which means the product applies a scaling I did not identify. The hue and relative ordering are trustworthy; the absolute levels are not. Murata, Saitoh & Sumida 2018, "True Color Imagery Rendering for Himawari-8 with a Color Reproduction Approach Based on the CIE XYZ Color System", would settle it.
3. **The exact chromaticity of the Belt of Venus.** Lee & Hernandez-Andres 2015 measured it hyperspectrally and found that "color distinctions between Earth's shadow and the sunlit sky above the arch were small or nil", which is a surprising and useful result, but I could only read the abstract. The full paper has the chromaticity curves that would let you pin the -2 to -6 degree stops to measurement instead of judgement.
4. **Whether to reproduce the airglow warm turn on the deep night side.** The Patat data unambiguously say the sky reddens below -13 degrees. My ramps only hint at it (hue pulled from 283 back toward 265). Going further would be honest but would make the night side look slightly muddy. Worth an A/B test in the actual app.
5. **How much to lift the ramp above the measured Apollo/Himawari lightness.** I chose +0.06 in OKLab L for ocean and +0.04 for land. This is the largest single aesthetic decision in the document and it should be a tunable, not a constant.
6. **Zotti & Wilkie's specific Preetham fixes.** The PDF would not extract as text. If you ever want a ground-view sky (a "what does it look like from here" panel), that paper is the reference for what breaks at low sun.
7. **6 bit panel interference.** No fix exists. If testers report a shimmering crosshatch on the gradient, it is their display, not your dither.

---

## 10. Sources

- USNO, Rise, Set, and Twilight Definitions: https://aa.usno.navy.mil/faq/RST_defs
- Patat, Ugolnikov & Postylyakov, UBVRI twilight sky brightness at ESO-Paranal, A&A 455, 385 (2006): https://arxiv.org/pdf/astro-ph/0604128
- Lee & Hernandez-Andres, Measuring and modeling twilight's purple light, Appl. Opt. 42, 445 (2003): https://opg.optica.org/ao/abstract.cfm?uri=ao-42-3-445
- Lee & Hernandez-Andres, Measuring and modeling twilight's Belt of Venus, Appl. Opt. 54, B194 (2015): https://opg.optica.org/ao/abstract.cfm?uri=ao-54-4-b194
- Wikipedia, Belt of Venus: https://en.wikipedia.org/wiki/Belt_of_Venus
- Wikipedia, Twilight: https://en.wikipedia.org/wiki/Twilight
- Wikipedia, Daylight (illuminance table): https://en.wikipedia.org/wiki/Daylight
- hnsky.org, The brightness (SQM) value of the twilight sky: https://www.hnsky.org/sqm_twilight.htm
- PhotoPills, Mastering Golden Hour, Blue Hour and Twilights: https://www.photopills.com/articles/mastering-golden-hour-blue-hour-magic-hours-and-twilights
- NPS, Natural Light in the Night Sky: https://www.nps.gov/subjects/nightskies/natural-light-in-night-sky.htm
- BBSO Earthshine project: https://www.bbso.njit.edu/Earthshine_webpage.html
- rp-photonics, Scotopic and Photopic Vision: https://www.rp-photonics.com/scotopic_and_photopic_vision.html
- Miller et al., GeoColor: A Blending Technique for Satellite Imagery, JTECH 37, 429 (2020): https://rammb2.cira.colostate.edu/wp-content/uploads/2020/01/jtechd190134.pdf
- NASA Blue Marble Next Generation: https://neo.gsfc.nasa.gov/view.php?datasetId=BlueMarbleNG
- NASA SVS, Black Marble 2016: https://svs.gsfc.nasa.gov/30876/
- NASA Black Marble User Guide, Collection 2.0: https://viirsland.gsfc.nasa.gov/PDF/BlackMarbleUserGuide_Collection2.0.pdf
- NOAA-20 VIIRS DNB on-orbit calibration and performance: https://ntrs.nasa.gov/citations/20210011523
- ESA, Milan at night, a decade of changes in street lighting: https://www.esa.int/ESA_Multimedia/Images/2022/10/Milan_at_night_A_decade_of_changes_in_street_lighting
- timeanddate.com Day and Night World Map: https://www.timeanddate.com/worldclock/sunearth.html
- in-the-sky.org twilight map: https://in-the-sky.org/twilightmap.php
- earth.nullschool.net about page: https://earth.nullschool.net/about.html
- Google Earth Studio special attributes: https://earth.google.com/studio/docs/advanced-features/special-attributes/
- Stellarium 0.22.0 release notes: https://stellarium.org/release/2022/03/27/stellarium-0.22.0.html
- CalcMySky in Stellarium: https://10110111.github.io/CalcMySky/using-in-stellarium.html
- Zotti & Wilkie, A Critical Review of the Preetham Skylight Model: https://www.cg.tuwien.ac.at/research/publications/2007/zotti-2007-wscg/zotti-2007-wscg-paper.pdf
- Celestia texture guide: https://www.classe.cornell.edu/~seb/celestia/textures.html
- Ottosson, Oklab: https://bottosson.github.io/posts/oklab/
- Ottosson, sRGB gamut clipping: https://bottosson.github.io/posts/gamutclipping/
- Wyman, Sloan & Shirley, Simple Analytic Approximations to the CIE XYZ Color Matching Functions, JCGT 2(2) 2013: https://jcgt.org/published/0002/02/01/paper.pdf
- Bruneton & Neyret, Precomputed Atmospheric Scattering, CGF 27(4) 2008: https://inria.hal.science/inria-00288758/file/article.pdf
- Bruneton reference implementation constants: https://github.com/ebruneton/precomputed_atmospheric_scattering (atmosphere/demo/demo.cc)
- O'Neil, Accurate Atmospheric Scattering, GPU Gems 2 ch.16: https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering
- Jimenez, Next Generation Post Processing in Call of Duty: Advanced Warfare, SIGGRAPH 2014: https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/
- LearnOpenGL, Physically Based Bloom: https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom
- frost.kiwi, How to (and how not to) fix color banding: https://blog.frost.kiwi/GLSL-noise-and-radial-gradient/
- Wronski, Dithering part two and part three: https://bartwronski.com/2016/10/30/dithering-part-two-golden-ratio-sequence-blue-noise-and-highpass-and-remap/ and https://bartwronski.com/2016/10/30/dithering-part-three-real-world-2d-quantization-dithering/
- Gjol, Banding in Games: A Noisy Rant: https://loopit.dk/banding_in_games.pdf
- Cox & Munk slope statistics, Ocean Optics Web Book: https://www.oceanopticsbook.info/view/surfaces/cox-munk-sea-surface-slope-statistics
- NICT Himawari real-time imagery (source of my measurements): https://himawari8.nict.go.jp/
- NASA image library, Apollo 17 AS17-148-22727: https://images-assets.nasa.gov/image/as17-148-22727/as17-148-22727~medium.jpg

---

## Appendix A: reproduction scripts

### A.1 Measuring colour versus solar elevation from Himawari full disk imagery

Requires `pillow` and `numpy`. Downloads a 550 px full disk true colour PNG from NICT, inverts the geostationary projection, computes the solar elevation for every pixel, and prints luminance-sorted percentiles per elevation bin. The 5th percentile within a bin is cloud-free surface, the 90th is cloud top. The validation that matters is that the product goes to pure black in exactly the bin that straddles elevation zero.

```python
import math, urllib.request, numpy as np
from PIL import Image

SUB_LON = 140.7                      # Himawari-9

def geos_latlon(w, h, sub_lon=SUB_LON):
    """Inverse LRIT/HRIT geostationary projection. Constants are the Himawari
    2 km full-disk grid (COFF=LOFF=2750.5, CFAC=LFAC=20466275 on 5500 px),
    scaled to whatever width the product uses."""
    k = 5500.0 / w
    COFF = LOFF = 2750.5 / k
    CFAC = LFAC = 20466275.0 / k
    c = np.arange(w)[None, :].astype(np.float64)
    l = np.arange(h)[:, None].astype(np.float64)
    x = np.radians((c - COFF) * (2.0 ** 16) / CFAC)
    y = np.radians((l - LOFF) * (2.0 ** 16) / LFAC)
    cx, cy, sx, sy = np.cos(x), np.cos(y), np.sin(x), np.sin(y)
    disc = (42164.0 * cx * cy) ** 2 - (cy ** 2 + 1.006739501 * sy ** 2) * 1737122264.0
    ok = disc > 0
    sd = np.sqrt(np.where(ok, disc, 0.0))
    sn = (42164.0 * cx * cy - sd) / (cy ** 2 + 1.006739501 * sy ** 2)
    s1, s2, s3 = 42164.0 - sn * cx * cy, sn * sx * cy, -sn * sy
    lon = np.degrees(np.arctan2(s2, s1)) + sub_lon
    lat = np.degrees(np.arctan(1.006739501 * s3 / np.hypot(s1, s2)))
    gamma = np.degrees(np.arccos(np.clip(
        np.cos(np.radians(lat)) * np.cos(np.radians(lon - sub_lon)), -1, 1)))
    return lat, lon, ok, gamma          # gamma = earth-central angle from nadir

def subsolar(y, mo, d, hh, mm):
    """Low-precision NOAA solar position. Returns (declination, subsolar longitude)."""
    import datetime
    dt = datetime.datetime(y, mo, d, hh, mm)
    jd = dt.toordinal() + 1721424.5 + (dt.hour + dt.minute / 60.0) / 24.0
    n = jd - 2451545.0
    L = (280.460 + 0.9856474 * n) % 360.0
    g = math.radians((357.528 + 0.9856003 * n) % 360.0)
    lam = math.radians(L + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g))
    eps = math.radians(23.439 - 0.0000004 * n)
    dec = math.degrees(math.asin(math.sin(eps) * math.sin(lam)))
    ra = math.degrees(math.atan2(math.cos(eps) * math.sin(lam), math.cos(lam))) % 360.0
    gmst = (18.697374558 + 24.06570982441908 * n) % 24.0 * 15.0
    return dec, (ra - gmst + 180.0) % 360.0 - 180.0

def elevation(lat, lon, dec, sslon):
    la, de = np.radians(lat), math.radians(dec)
    H = np.radians(lon - sslon)
    return np.degrees(np.arcsin(np.clip(
        np.sin(la) * math.sin(de) + np.cos(la) * math.cos(de) * np.cos(H), -1, 1)))

def fetch(y, mo, d, hh, mm):
    url = (f'https://himawari8.nict.go.jp/img/D531106/1d/550/'
           f'{y}/{mo:02d}/{d:02d}/{hh:02d}{mm:02d}00_0_0.png')
    fn = f'h_{hh:02d}{mm:02d}.png'
    open(fn, 'wb').write(urllib.request.urlopen(url, timeout=60).read())
    return fn

def report(t, box=None, maxgamma=62.0):
    im = np.asarray(Image.open(fetch(*t)).convert('RGB')).astype(np.float64)
    h, w, _ = im.shape
    lat, lon, ok, gamma = geos_latlon(w, h)
    e = elevation(lat, lon, *subsolar(*t))
    m = ok & (gamma < maxgamma)
    if box:
        la0, la1, lo0, lo1 = box
        m &= (lat >= la0) & (lat <= la1) & (lon >= lo0) & (lon <= lo1)
    lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
    hexs = lambda c: '#%02x%02x%02x' % tuple(int(round(v)) for v in c)
    for lo in range(-14, 90, 2):
        sel = m & (e >= lo) & (e < lo + 2)
        n = int(sel.sum())
        if n < 200:
            continue
        px = im[sel][np.argsort(lum[sel])]
        out = []
        for q in (0.05, 0.50, 0.90):
            i = int(q * (n - 1))
            a, b = max(0, i - n // 60), min(n, i + n // 60 + 1)
            out.append(hexs(px[a:b].mean(axis=0)))
        print(f'{lo:+4d}..{lo+2:+4d} n={n:6d}  p05 {out[0]}  p50 {out[1]}  p90 {out[2]}')

report((2026, 8, 14, 9, 0))
# useful boxes: Australian desert (-31,-21,121,145), Southern Ocean (-45,-33,115,155)
```

### A.2 The spectral top-of-atmosphere model

Reproduces result A (direct beam colour) and result B (nadir TOA colour). Every constant is cited in section 2.3. The sanity check is that feeding the unattenuated solar spectrum through the pipeline returns exactly `#ffffff`.

```python
import math

LMIN, LMAX, STEP = 360, 830, 10
LAMS = list(range(LMIN, LMAX + 1, STEP))

# ASTM G-173 ETR, averaged in 10 nm bins, W m^-2 nm^-1  (Bruneton demo.cc)
E0 = [1.11776,1.14259,1.01249,1.14716,1.72765,1.73054,1.6887,1.61253,1.91198,2.03474,
      2.02042,2.02212,1.93377,1.95809,1.91686,1.8298,1.8685,1.8931,1.85149,1.8504,
      1.8341,1.8345,1.8147,1.78158,1.7533,1.6965,1.68194,1.64654,1.6048,1.52143,
      1.55622,1.5113,1.474,1.4482,1.41018,1.36775,1.34188,1.31429,1.28303,1.26758,
      1.2367,1.2082,1.18737,1.14683,1.12362,1.1058,1.07124,1.04992]

# IUP Bremen 2011 ozone cross sections at 233 K, m^2  (Bruneton demo.cc)
O3X = [1.18e-27,2.182e-28,2.818e-28,6.636e-28,1.527e-27,2.763e-27,5.52e-27,8.451e-27,
       1.582e-26,2.316e-26,3.669e-26,4.924e-26,7.752e-26,9.016e-26,1.48e-25,1.602e-25,
       2.139e-25,2.755e-25,3.091e-25,3.5e-25,4.266e-25,4.672e-25,4.398e-25,4.701e-25,
       5.019e-25,4.305e-25,3.74e-25,3.215e-25,2.662e-25,2.238e-25,1.852e-25,1.473e-25,
       1.209e-25,9.423e-26,7.455e-26,6.566e-26,5.105e-26,4.15e-26,4.228e-26,3.237e-26,
       2.451e-26,2.801e-26,2.534e-26,1.624e-26,1.465e-26,2.078e-26,1.383e-26,7.105e-27]

DU, H_R, K_RAY, MIE_SSA, MIE_G = 2.687e20, 8000.0, 1.24062e-6, 0.9, 0.8

tau_R  = lambda nm: K_RAY * (nm / 1000.0) ** -4 * H_R
tau_M  = lambda nm, aod=0.05, a=1.3: aod * (nm / 550.0) ** -a
tau_O3 = lambda nm, du=300.0: du * DU * O3X[(nm - LMIN) // STEP]

def airmass(h):                      # Kasten & Young 1989
    h = max(h, 0.0)
    return 1.0 / (math.sin(math.radians(h)) + 0.50572 * (h + 6.07995) ** -1.6364)

# CIE 1931 2-deg CMFs, Wyman/Sloan/Shirley 2013 multi-lobe Gaussian fit
def _g(w, mu, s1, s2):
    t = (w - mu) * (s1 if w < mu else s2)
    return math.exp(-0.5 * t * t)
xbar = lambda w: 0.362*_g(w,442.0,.0624,.0374) + 1.056*_g(w,599.8,.0264,.0323) - 0.065*_g(w,501.1,.0490,.0382)
ybar = lambda w: 0.821*_g(w,568.8,.0213,.0247) + 0.286*_g(w,530.9,.0613,.0322)
zbar = lambda w: 1.217*_g(w,437.0,.0845,.0278) + 0.681*_g(w,459.0,.0385,.0725)

M = ((3.2406,-1.5372,-0.4986), (-0.9689,1.8758,0.0415), (0.0557,-0.2040,1.0570))

def spd_to_lin(spd):
    X = sum(s*xbar(w) for s,w in zip(spd,LAMS))
    Y = sum(s*ybar(w) for s,w in zip(spd,LAMS))
    Z = sum(s*zbar(w) for s,w in zip(spd,LAMS))
    return tuple(m[0]*X + m[1]*Y + m[2]*Z for m in M)

WP = spd_to_lin(E0)                  # white point is sunlight in space
enc = lambda c: 12.92*c if c <= 0.0031308 else 1.055*max(c,0.0)**(1/2.4) - 0.055

def hexs(rgb):
    m = max(rgb)
    return '#%02x%02x%02x' % tuple(min(255, max(0, round(255*enc(c/m)))) for c in rgb)

# --- Result A: the direct beam at the ground
for h in (90, 45, 30, 20, 15, 10, 6, 4, 2, 1, 0):
    m = airmass(h)
    spd = [E0[i]*math.exp(-m*(tau_R(w) + tau_O3(w) + tau_M(w))) for i, w in enumerate(LAMS)]
    wb = tuple(a/b for a, b in zip(spd_to_lin(spd), WP))
    print(f'{h:3d} deg  airmass {m:6.2f}  {hexs(wb)}  wb linear {tuple(round(v,4) for v in wb)}')

# --- Result B: nadir TOA, single scattering plus a lambertian surface
def toa(h, albedo, aod=0.05, du=300.0):
    ms, mv = airmass(h), 1.0
    mu_s = math.sin(math.radians(max(h, 0.001)))
    cosT = -mu_s                                   # backscatter for a nadir view
    pR = 0.75 * (1.0 + cosT*cosT)
    pM = (1 - MIE_G**2) / (1 + MIE_G**2 - 2*MIE_G*cosT) ** 1.5
    out = []
    for i, w in enumerate(LAMS):
        tR, tM, tO = tau_R(w), tau_M(w, aod), tau_O3(w, du)
        tE = tR + tM + tO
        path = ((tR*pR + MIE_SSA*tM*pM) / 4.0) * (1.0 - math.exp(-tE*(ms+mv))) / tE
        surf = albedo(w) * math.exp(-tE*(ms+mv))
        out.append(E0[i] * mu_s * (path + surf))
    return spd_to_lin(out)

ocean = lambda w: 0.030 if w < 500 else (0.020 if w < 600 else 0.008)
snow  = lambda w: 0.95 if w < 700 else 0.85
EXPOSURE = 0.85 / max(a/b for a, b in zip(toa(60, snow), WP))
for h in (80, 60, 40, 20, 10, 6, 4, 2, 1):
    c = tuple(EXPOSURE * a/b for a, b in zip(toa(h, ocean), WP))
    print(h, '#%02x%02x%02x' % tuple(min(255, max(0, round(255*enc(v)))) for v in c))
```

### A.3 Sampling Blue Marble and Black Marble

```python
import numpy as np, urllib.request
from PIL import Image

def get(url):
    fn = url.rsplit('/', 1)[1]
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    open(fn, 'wb').write(urllib.request.urlopen(req, timeout=120).read())
    return np.asarray(Image.open(fn).convert('RGB')).astype(np.float64)

bm = get('https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg')
nl = get('https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg')

def patch(im, lat, lon, r=3):
    h, w, _ = im.shape
    x = int((lon + 180.0) / 360.0 * w) % w
    y = min(max(int((90.0 - lat) / 180.0 * h), 0), h - 1)
    return im[y-r:y+r+1, x-r:x+r+1].reshape(-1, 3).mean(axis=0)

# global median land colour: mask out the synthetic navy this product uses for ocean
ocean = (np.abs(bm[..., 2] - 50) < 14) & (bm[..., 0] < 30) & (bm[..., 1] < 30)
print('median land', '#%02x%02x%02x' % tuple(int(v) for v in np.median(bm[~ocean], axis=0)))

lum = 0.2126*nl[..., 0] + 0.7152*nl[..., 1] + 0.0722*nl[..., 2]
print('mean colour of lum>150 pixels',
      '#%02x%02x%02x' % tuple(int(v) for v in nl[lum > 150].mean(axis=0)))

# radial profile around a city, in 0.1 degree pixels
def profile(im, lat, lon, rmax=20):
    h, w, _ = im.shape
    x = int((lon + 180.0) / 360.0 * w) % w
    y = int((90.0 - lat) / 180.0 * h)
    for r in range(0, rmax + 1, 2):
        ring = [im[(y+dy) % h, (x+dx) % w]
                for dy in range(-r-1, r+2) for dx in range(-r-1, r+2)
                if r - 0.5 <= (dx*dx + dy*dy) ** 0.5 < r + 0.5]
        if ring:
            m = np.mean(ring, axis=0)
            print(f'  r={r:2d}  #%02x%02x%02x  lum={0.2126*m[0]+0.7152*m[1]+0.0722*m[2]:6.1f}'
                  % tuple(int(v) for v in m))

profile(nl, 35.68, 139.69)   # Tokyo
```

### A.4 Regenerating the ramps

```python
import math
from oklab_helpers import oklch_to_hex     # section 4.3

OCEAN = [(90,.345,.080,250), (60,.340,.079,250), (30,.325,.076,251), (18,.305,.072,252),
         (12,.290,.068,253), ( 6,.268,.063,256), ( 2,.248,.058,259), ( 0,.234,.056,262),
         (-2,.212,.058,267), (-4,.192,.062,272), (-6,.174,.064,276), (-9,.152,.062,278),
         (-12,.134,.052,280), (-15,.121,.038,282), (-18,.114,.028,272), (-25,.112,.026,262)]
LAND  = [(90,.560,.056,101), (60,.552,.058,100), (30,.532,.062, 97), (18,.505,.068, 91),
         (12,.482,.074, 86), ( 6,.445,.084, 76), ( 2,.400,.094, 62), ( 0,.372,.098, 53),
         (-2,.320,.092, 40), (-4,.272,.078, 22), (-6,.232,.066,350), (-9,.190,.058,300),
         (-12,.160,.048,284), (-15,.140,.036,283), (-18,.130,.027,274), (-25,.127,.025,263)]
ICE   = [(90,.960,.010,100), (60,.945,.014, 97), (30,.912,.022, 90), (18,.876,.032, 82),
         (12,.848,.040, 76), ( 6,.795,.054, 64), ( 2,.730,.070, 48), ( 0,.690,.076, 40),
         (-2,.610,.076, 27), (-4,.520,.070,  6), (-6,.440,.062,330), (-9,.345,.058,292),
         (-12,.270,.050,283), (-15,.215,.038,282), (-18,.188,.029,274), (-25,.182,.026,263)]

for name, ramp in (('OCEAN', OCEAN), ('LAND', LAND), ('ICE', ICE)):
    print(name)
    prev = None
    for e, L, C, H in ramp:
        a, b = C*math.cos(math.radians(H)), C*math.sin(math.radians(H))
        d = '' if prev is None else f'  dE_ok={math.dist((L,a,b), prev):.4f}'
        prev = (L, a, b)
        print(f'  {e:+4d}  {oklch_to_hex(L, C, H)}{d}')
```

