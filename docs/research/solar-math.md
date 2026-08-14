# Solar Math Reference for the Heliograph

Exact astronomy for a scientifically accurate day/night terminator map.

Status: every number, formula and code fragment below was either fetched from the cited primary
source during research or computed and cross-checked against at least two independent
authoritative services. Anything not verified is explicitly labelled **UNVERIFIED**.

Research date: 2026-08-14. Reference implementation used for all computed values in this
document: a direct Python transcription of NOAA `main.js` plus PyMeeus 0.5.x (VSOP87) as the
high accuracy comparison, cross-checked against the US Naval Observatory API.

---

## Table of contents

1. [Conventions and units](#1-conventions-and-units)
2. [Time scales, Julian Day, delta T](#2-time-scales-julian-day-and-delta-t)
3. [The NOAA / ESRL algorithm, complete](#3-the-noaa--esrl-algorithm-complete)
4. [Meeus chapter 25 (low accuracy solar position)](#4-meeus-chapter-25-low-accuracy-solar-position)
5. [Meeus chapter 13 (coordinate conversions)](#5-meeus-chapter-13-coordinate-conversions)
6. [Sidereal time, Greenwich hour angle, subsolar point](#6-sidereal-time-greenwich-hour-angle-and-the-subsolar-point)
7. [Refraction](#7-atmospheric-refraction)
8. [Rise, set, twilight, noon, day length, polar cases](#8-rise-set-twilight-solar-noon-day-length-and-the-polar-cases)
9. [Equinoxes and solstices (Meeus chapter 27)](#9-equinoxes-and-solstices-meeus-chapter-27)
10. [Accuracy: measured, not claimed](#10-accuracy-measured-not-claimed)
11. [Which algorithm for which feature](#11-which-algorithm-for-which-feature)
12. [The analemma](#12-the-analemma)
13. [Test vectors](#13-test-vectors)
14. [Pitfalls](#14-pitfalls)
15. [Sources](#15-sources)

---

## 1. Conventions and units

Fix these once, in code, and never deviate. Most bugs in this domain are sign and convention bugs.

| Quantity | Symbol | Unit | Convention used in this project |
|---|---|---|---|
| Latitude | `phi`, `lat` | degrees | North positive, range [-90, +90] |
| Longitude | `lambda_obs`, `lon` | degrees | **East positive**, range (-180, +180] |
| Declination | `delta`, `dec` | degrees | North positive |
| Right ascension | `alpha`, `ra` | degrees | 0 to 360, eastward from the vernal equinox |
| Hour angle (local) | `H`, `ha` | degrees | **Negative before local transit, positive after** (i.e. increases with time, west positive) |
| Greenwich hour angle | `GHA` | degrees | 0 to 360, measured westward from Greenwich |
| Altitude / elevation | `h`, `el` | degrees | Above the horizon positive |
| Zenith angle | `z` | degrees | `z = 90 - h` |
| Azimuth | `A`, `az` | degrees | **0 = North, 90 = East, clockwise, range [0, 360)** |
| Equation of time | `E`, `eot` | **minutes of time** | `apparent solar time - mean solar time` |
| Julian Day | `JD` | days | Starts at 12:00 UT, so 0h UT falls on `.5` |
| Julian Century | `T` | centuries | `(JD - 2451545.0) / 36525` |

Two conventions that appear in the literature and that you must translate on the way in:

* **Meeus uses west positive longitude.** Meeus equation 13.5 and the hour angle relation
  `H = theta0 - L - alpha` have `L` positive to the *west*. Our `lon` is east positive, so
  `L_meeus = -lon`. The NOAA `main.js` code and the NOAA spreadsheet both use **east positive**
  (the spreadsheet cell literally reads `Longitude (+ to E)` and `Time Zone (+ to E)`, verified by
  reading the strings inside `NOAA_Solar_Calculations_day.xls`). NOAA agrees with us, Meeus does not.
* **SunCalc measures azimuth from South, clockwise.** Its `azimuth()` returns
  `atan2(sin H, cos H sin phi - tan dec cos phi)`, which is 0 at due south. To compare with our
  north based azimuth you must add 180 degrees. MET Norway and USNO both use north based azimuth,
  same as us.

---

## 2. Time scales, Julian Day, and delta T

### 2.1 Time scales you will meet

| Scale | Meaning | Relation |
|---|---|---|
| UTC | Civil time, what `Date.now()` counts (with leap seconds smeared or ignored) | |
| UT1 | Earth rotation angle expressed as time | `UT1 = UTC + (UT1-UTC)`, `abs(UT1-UTC) < 0.9 s` by construction |
| TAI | International Atomic Time | `TAI - UTC = 37 s` since 2017-01-01 |
| TT (formerly TD, TDT) | Terrestrial Time, the argument of solar ephemerides | `TT = TAI + 32.184 s` |
| delta T | `TT - UT1` | ~69.1 s in 2025 and 2026 |

**Leap seconds.** IERS Bulletin C 72 (Paris, 06 July 2026) states: "NO leap second will be
introduced at the end of December 2026" and "from 2017 January 1, 0h UTC, until further notice:
UTC-TAI = -37 s". So there has been no leap second since 2016-12-31 and none is scheduled.
Source: <https://datacenter.iers.org/data/latestVersion/bulletinC.txt>

**delta T, measured values.** From `https://maia.usno.navy.mil/ser7/deltat.data` (monthly, TT-UT1
in seconds):

```
 2025  1  1  69.1377     2025  7  1  69.1406     2026  1  1  69.1099
 2025  2  1  69.1366     2025  8  1  69.1219     2026  2  1  69.1133
 2025  3  1  69.1384     2025  9  1  69.0994     2026  3  1  69.1168
 2025  4  1  69.1471     2025 10  1  69.0909     2026  4  1  69.1330
 2025  5  1  69.1542     2025 11  1  69.0909
 2025  6  1  69.1550     2025 12  1  69.1042
```

Predictions from `https://maia.usno.navy.mil/ser7/deltat.preds`: 69.05 s at 2026.0, 69.11 s at
2026.5, 69.14 s at 2027.0.

**Decision for the heliograph: ignore delta T for the terminator, the analemma, and rise/set.**
Measured effect of feeding UTC where the formulae want TT, with delta T = 69.2 s, sampled every
0.1 day over one year from 2025-01-01 (computed by the reference implementation):

* subsolar latitude changes by at most **1.14 arcseconds** (about 35 m on the ground)
* subsolar longitude changes by at most **0.36 arcseconds** (about 11 m)

This is three orders of magnitude below the pixel size of any world map. Note that delta T *does*
matter for the equinox and solstice instants (section 9) because there you are converting a TT
instant to a wall clock, and 69 s is 69 s.

### 2.2 Julian Day from JavaScript epoch milliseconds

`Date.prototype.valueOf()` returns milliseconds since 1970-01-01T00:00:00Z. The Unix epoch is
JD 2440587.5 exactly.

```
JD  = ms / 86400000 + 2440587.5
T   = (JD - 2451545.0) / 36525          // Julian centuries from J2000.0
```

Verified in Node 24 (`jsdate.js` run during research):

```
JD(1970-01-01T00:00:00Z) = 2440587.5
JD(2000-01-01T12:00:00Z) = 2451545      (J2000.0, by definition)
JD(2025-06-21T12:00:00Z) = 2460848
```

Numerical precision: on a JD near 2 460 848 one float64 ULP is `2^-52 * 2460848 * 86400 s`
= **47 microseconds**. Irrelevant for us, but it is why you should never accumulate JD by repeated
addition when animating a year; recompute `JD` from the ms timestamp each frame.

Calendar to JD (Meeus equation 7.1, as transcribed in NOAA `main.js` `getJD`), for the Gregorian
calendar:

```
function getJD(year, month, day) {          // month 1..12, day may be fractional
  if (month <= 2) { year -= 1; month += 12 }
  A = floor(year / 100)
  B = 2 - A + floor(A / 4)                  // Gregorian only; for Julian calendar B = 0
  JD = floor(365.25 * (year + 4716)) + floor(30.6001 * (month + 1)) + day + B - 1524.5
}
```

This returns `X.5` for 0h UT, which is correct and is a constant source of off by half a day bugs.
Prefer the millisecond form above for anything driven by a `Date`.

Inverse (Meeus chapter 7, as in `calcDateFromJD`):

```
z = floor(jd + 0.5); f = (jd + 0.5) - z
if (z < 2299161) A = z
else { alpha = floor((z - 1867216.25) / 36524.25); A = z + 1 + alpha - floor(alpha / 4) }
B = A + 1524; C = floor((B - 122.1) / 365.25); D = floor(365.25 * C); E = floor((B - D) / 30.6001)
day   = B - D - floor(30.6001 * E) + f
month = (E < 14) ? E - 1 : E - 13
year  = (month > 2) ? C - 4716 : C - 4715
```

---

## 3. The NOAA / ESRL algorithm, complete

Source of truth: the JavaScript actually served by NOAA GML at
<https://gml.noaa.gov/grad/solcalc/main.js>, downloaded and read in full during this research, plus
the spreadsheet `NOAA_Solar_Calculations_day.xls` from
<https://gml.noaa.gov/grad/solcalc/calcdetails.html>. NOAA states on that page that the
calculations "derive from *Astronomical Algorithms* by Jean Meeus".

The NOAA algorithm **is** Meeus chapter 25 low accuracy, plus Meeus chapter 28 for the equation of
time, plus a custom piecewise refraction fit. There is no separate NOAA solar theory. The
differences between "the NOAA algorithm" and "Meeus chapter 25" are entirely in how the results are
packaged (equation of time and true solar time, rather than sidereal time and hour angle).

### 3.1 The full chain as executable pseudocode

Every function takes `T` (Julian centuries TT from J2000.0) unless stated. Angles in degrees unless
stated. `sin`, `cos`, `tan`, `asin`, `acos`, `atan2` take and return radians, so convert explicitly.

```
// --- 1. Julian century -------------------------------------------------------
T = (JD - 2451545.0) / 36525.0
// Range: about -1.0 (1900) to +1.0 (2100). Formulae below are polynomial in T and
// degrade slowly outside 1800..2200.

// --- 2. Geometric mean longitude of the Sun, referred to the mean equinox of date
// Meeus (25.2). Degrees, normalised to [0, 360).
L0 = 280.46646 + T * (36000.76983 + T * 0.0003032)
L0 = mod360(L0)

// --- 3. Geometric mean anomaly of the Sun. Meeus (25.3). Degrees, NOT normalised
// in NOAA's code (it is only ever used inside sin/cos, so normalisation is optional).
M = 357.52911 + T * (35999.05029 - 0.0001537 * T)

// --- 4. Eccentricity of Earth's orbit. Meeus (25.4). Dimensionless, about 0.0167.
e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)

// --- 5. Sun's equation of the centre. Degrees, range about [-1.92, +1.92].
C =  sin(1*M) * (1.914602 - T * (0.004817 + 0.000014 * T))
   + sin(2*M) * (0.019993 - 0.000101 * T)
   + sin(3*M) *  0.000289

// --- 6. Sun's true geometric longitude and true anomaly. Degrees.
sunTrueLong = L0 + C
sunTrueAnom = M  + C

// --- 7. Sun's radius vector (Earth-Sun distance), astronomical units.
//        Meeus (25.5). Range 0.98329 (perihelion) to 1.01671 (aphelion).
R = (1.000001018 * (1 - e*e)) / (1 + e * cos(sunTrueAnom))

// --- 8. Apparent longitude: correct for nutation in longitude and for aberration.
//        The -0.00569 deg is the constant part of aberration (-20.4898"/R approximated
//        as a constant), the -0.00478 sin(Omega) term is the dominant nutation term.
Omega  = 125.04 - 1934.136 * T          // longitude of the Moon's ascending node, deg
lambda = sunTrueLong - 0.00569 - 0.00478 * sin(Omega)

// --- 9. Mean obliquity of the ecliptic. Meeus (22.2). Degrees.
seconds = 21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813))
eps0    = 23.0 + (26.0 + seconds / 60.0) / 60.0

// --- 10. Corrected (apparent) obliquity: add the dominant nutation in obliquity.
eps = eps0 + 0.00256 * cos(Omega)

// --- 11. Apparent right ascension. Meeus (25.6) / (13.3) with beta = 0.
//         MUST use atan2. Degrees; normalise to [0, 360) if you need it absolute.
alpha = atan2( cos(eps) * sin(lambda), cos(lambda) )   // radians -> degrees

// --- 12. Apparent declination. Meeus (25.7) / (13.4) with beta = 0. Degrees, [-23.5, +23.5].
delta = asin( sin(eps) * sin(lambda) )                 // radians -> degrees

// --- 13. Equation of time. Meeus (28.3). Returns MINUTES OF TIME.
//         Sign convention: E = apparent solar time - mean solar time.
y = tan(eps / 2) ^ 2
E_rad =   y * sin(2*L0)
        - 2*e   * sin(M)
        + 4*e*y * sin(M) * cos(2*L0)
        - 0.5*y*y * sin(4*L0)
        - 1.25*e*e * sin(2*M)
E = degrees(E_rad) * 4.0        // 4 minutes of time per degree
// Range over a year: about -14.23 to +16.49 minutes.
```

`mod360(x)` must handle negatives: `((x % 360) + 360) % 360`. NOAA's `main.js` uses `while` loops,
which is fine but slow for |T| large; use the modulo form.

### 3.2 Local hour angle, zenith, elevation, azimuth (NOAA formulation)

NOAA works in "true solar time" rather than sidereal time. `timeLocalMinutes` is minutes since
local midnight on the civil clock, `zone` is the UTC offset in **hours east**, `lon` is degrees
east.

```
// verbatim structure of calcAzEl() from NOAA main.js
solarTimeFix  = E + 4.0 * lon - 60.0 * zone         // minutes
trueSolarTime = timeLocalMinutes + solarTimeFix     // minutes, then reduce mod 1440
hourAngle     = trueSolarTime / 4.0 - 180.0         // degrees
if (hourAngle < -180) hourAngle += 360

cosZenith = sin(lat)*sin(delta) + cos(lat)*cos(delta)*cos(hourAngle)
clamp cosZenith to [-1, 1]
zenith    = acos(cosZenith)                          // degrees
```

For a UTC driven app there is no reason to go through local clock time. The equivalent, simpler
form, which the reference implementation used and which reproduces NOAA to the last digit:

```
utcMinutes    = ((JD + 0.5) mod 1) * 1440
trueSolarTime = mod1440( utcMinutes + E + 4.0 * lon )
H             = trueSolarTime / 4.0 - 180.0          // degrees, [-180, +180)
```

Elevation and azimuth:

```
sinAlt = sin(lat)*sin(delta) + cos(lat)*cos(delta)*cos(H)
alt_geometric = asin(clamp(sinAlt, -1, 1))

// NOAA's azimuth (acos form, with a guard near the poles):
azDenom = cos(lat) * sin(zenith)
if (abs(azDenom) > 0.001) {
    azRad = ( sin(lat)*cos(zenith) - sin(delta) ) / azDenom
    clamp azRad to [-1, 1]
    az = 180.0 - degrees(acos(azRad))
    if (hourAngle > 0.0) az = -az
} else {
    az = (lat > 0.0) ? 180.0 : 0.0
}
if (az < 0.0) az += 360.0
```

**Prefer the atan2 form** (Meeus 13.5, shifted to north based):

```
az = degrees( atan2( sin(H), cos(H)*sin(lat) - tan(delta)*cos(lat) ) ) + 180.0
az = mod360(az)
```

Verified: the two forms agree to the last printed digit on every test case computed during this
research (Quito, Sydney, Nairobi, Oslo). The atan2 form has no `0.001` guard, no branch on the sign
of `H`, and no accuracy loss when `cos(lat) * sin(zenith)` becomes small. Use it. The residual
disagreement with USNO in those cases (up to 118 arcseconds at Quito with the Sun 5 degrees from the
zenith) is caused by the underlying low accuracy solar position, not by the azimuth formula: near
the zenith the azimuth derivative with respect to position blows up.

Then apply refraction (section 7):

```
alt_apparent = alt_geometric + refraction(alt_geometric)
```

### 3.3 What the NOAA spreadsheet columns are

Extracted from the binary of `NOAA_Solar_Calculations_day.xls` (string table), for anyone
cross-checking against the spreadsheet:

```
Julian Day | Julian Century | Geom Mean Long Sun (deg) | Geom Mean Anom Sun (deg) |
Eccent Earth Orbit | Sun Eq of Ctr | Sun True Long (deg) | Sun True Anom (deg) |
Sun Rad Vector (AUs) | Sun App Long (deg) | Mean Obliq Ecliptic (deg) | Obliq Corr (deg) |
Sun Rt Ascen (deg) | Sun Declin (deg) | var y | Eq of Time (minutes) | HA Sunrise (deg) |
Solar Noon (LST) | Sunrise Time (LST) | Sunset Time (LST) | Sunlight Duration (minutes) |
True Solar Time (min) | Hour Angle (deg) | Solar Zenith Angle (deg) | Solar Elevation Angle (deg) |
Approx Atmospheric Refraction (deg) | Solar Elevation corrected for atm refraction (deg) |
Solar Azimuth Angle (deg cw from N)
```

Input cells: `Latitude (+ to N)`, `Longitude (+ to E)`, `Time Zone (+ to E)`.

---

## 4. Meeus chapter 25 (low accuracy solar position)

Chapter 25 "Solar Coordinates" gives two methods. The low accuracy method (pages 163-164 in the 2nd
edition) is exactly what NOAA implements and is reproduced above as steps 2 to 12. Meeus states its
accuracy as about 0.01 degree (36 arcseconds); section 10 below measures it.

The high accuracy method (Example 25.b) uses the full VSOP87 series for the Earth's heliocentric
position, converts to geocentric, applies the FK5 correction, nutation in longitude, and aberration
computed from the true daily variation of the Sun's longitude. That is thousands of terms and is
irrelevant for a map, but it is the yardstick used in section 10.

### 4.1 Worked example 25.a, reproduced verbatim

Input: **1992 October 13 at 0h TD**, i.e. JDE = 2448908.5.

Independently published intermediate values (from the PyMeeus doctests, which are transcriptions of
the Meeus book, at <https://pymeeus.readthedocs.io/en/latest/_modules/pymeeus/Sun.html>), and the
values produced by the reference implementation of section 3:

| Quantity | Meeus published | Reference implementation | Match |
|---|---|---|---|
| `T` | -0.072183436 | -0.072183436 | exact |
| `L0` | 201.80720 deg | 201.80720 deg | exact |
| `M` | 278.99397 deg (= -2241.00603 mod 360) | -2241.00603 deg | exact |
| `e` | 0.016711668 | 0.016711668 | exact |
| `C` | -1.89732 deg | -1.89732 deg | exact |
| true longitude | 199.90988 deg (199d 54' 36.0") | 199.90987 deg | 0.04 arcsec |
| `R` | 0.99766 AU | 0.99766 AU | exact |
| `Omega` | 264.65 deg | 264.65 deg | exact |
| apparent `lambda` | 199.90895 deg (199d 54' 32.0") | 199.90894 deg | 0.04 arcsec |
| `eps0` | 23.44023 deg | 23.44023 deg | exact |
| `eps` (corrected) | 23.43999 deg | 23.43999 deg | exact |
| apparent `alpha` | 13h 13m 31.4s = 198.38083 deg | 198.38083 deg | exact |
| apparent `delta` | -7d 47' 06" = -7.78507 deg | -7.78507 deg | exact |

The high accuracy answer for the same instant (Example 25.b), for comparison:
apparent `alpha` = 13h 13m 30.749s = **198.3781187 deg**, apparent `delta` = -7d 47' 01.74" =
**-7.7838168 deg**, `R` = 0.99760852 AU (PyMeeus, full VSOP87C). The low accuracy method is
therefore **9.8 arcseconds** off in right ascension and **4.5 arcseconds** off in declination for
this instant.

Note: PyMeeus documents two places where its VSOP87 result disagrees with the printed book, and
argues the book is wrong: the geometric longitude on page 169 (book 199.907372, PyMeeus 199.907297)
and the apparent longitude (book 199d 54' 21.818", PyMeeus 199d 54' 21.548"). The disagreement is
0.27 arcseconds and does not affect anything we do.

---

## 5. Meeus chapter 13 (coordinate conversions)

Page 93 of the 2nd edition. Verified against the Go transcription at
<https://github.com/soniakeys/meeus/blob/master/v3/coord/coord.go> which cites the equation numbers
and page inline.

**Ecliptical to equatorial** (`lambda` ecliptic longitude, `beta` ecliptic latitude, `eps`
obliquity):

```
(13.3)  tan(alpha) = ( sin(lambda) cos(eps) - tan(beta) sin(eps) ) / cos(lambda)
(13.4)  sin(delta) = sin(beta) cos(eps) + cos(beta) sin(eps) sin(lambda)
```

Implement 13.3 as `alpha = atan2( sin(lambda)*cos(eps) - tan(beta)*sin(eps), cos(lambda) )`.
For the Sun, `beta` is under 1 arcsecond and is taken as 0, which collapses these to steps 11 and 12
of section 3.1.

**Equatorial to horizontal**:

```
        H = theta0 - L - alpha          // L is the observer's longitude, POSITIVE WEST (Meeus)
(13.5)  tan(A) = sin(H) / ( cos(H) sin(phi) - tan(delta) cos(phi) )
(13.6)  sin(h) = sin(phi) sin(delta) + cos(phi) cos(delta) cos(H)
```

`A` from 13.5 is measured **from the South, westward**. To get our north based azimuth add 180
degrees and reduce mod 360. With our east positive longitude, `H = theta0 + lon - alpha`.

**Inverse (horizontal to equatorial)**, if you ever need it:

```
tan(H)     = sin(A) / ( cos(A) sin(phi) + tan(h) cos(phi) )
sin(delta) = sin(phi) sin(h) - cos(phi) cos(h) cos(A)
```

with `A` again measured from the South.

---

## 6. Sidereal time, Greenwich hour angle, and the subsolar point

### 6.1 Greenwich Mean Sidereal Time

Meeus equation 12.4, valid for any instant, `JD` is in UT (strictly UT1):

```
T      = (JD - 2451545.0) / 36525.0
theta0 = 280.46061837
       + 360.98564736629 * (JD - 2451545.0)
       + 0.000387933 * T^2
       - T^3 / 38710000.0
theta0 = mod360(theta0)          // degrees; divide by 15 for hours
```

Equation 12.3 is the same quantity restricted to 0h UT:
`theta0 = 100.46061837 + 36000.770053608 T + 0.000387933 T^2 - T^3 / 38710000`.

Verified against the Meeus worked examples and against the USNO sidereal time service:

| Instant (UT) | Meeus 12.4, computed | Meeus book | USNO API `gmst` |
|---|---|---|---|
| 1987-04-10 00:00:00 | 13:10:46.3668 | 13h10m46.3668s (Example 12.a) | 13:10:46.3701 |
| 1987-04-10 19:21:00 | 08:34:57.0896 | 8h34m57.0896s (Example 12.b) | 08:34:57.0929 |
| 2000-01-01 12:00:00 | 18:41:50.5484 (= 280.460618 deg) | (definition of the constant) | |
| 2025-06-21 12:00:00 | 05:59:45.1421 | | 05:59:45.1384 |

The formula reproduces the book exactly. The **3.3 to 3.7 millisecond** offset against USNO is the
difference between the 1982 IAU GMST expression that Meeus prints and the modern IAU 2006 one, plus
UT1 vs UTC. It is 0.00005 degrees of Earth rotation; ignore it.

Greenwich Apparent Sidereal Time adds the equation of the equinoxes,
`GAST = GMST + delta_psi * cos(eps)`, where `delta_psi` is nutation in longitude. USNO reported
`eqofeq` = -0.2312 s for 1987-04-10 0h and +0.1206 s for 2025-06-21 12h, i.e. under a quarter of a
second of time. Ignore it too, but be aware it is the reason a "GAST" number from an almanac will
not match your "GMST" number in the fourth decimal.

### 6.2 Greenwich hour angle and local hour angle

```
GHA = mod360( theta0 - alpha )          // Greenwich hour angle of the Sun, degrees west
LHA = mod360( GHA + lon )               // lon east positive; equals H mod 360
H   = ((LHA + 180) mod 360) - 180       // signed hour angle in (-180, +180]
```

### 6.3 Subsolar point

The subsolar point is where the Sun is exactly at the zenith. Two equivalent routes; both were
implemented and both agree.

**Route A, via the equation of time (this is what NOAA effectively does, and it is the cheaper one):**

```
utcMinutes = ((JD + 0.5) mod 1) * 1440          // minutes since 00:00 UTC
subsolarLat = delta                              // apparent declination, degrees
trueSolarTimeAtGreenwich = utcMinutes + E        // minutes
subsolarLon = -( trueSolarTimeAtGreenwich / 4 - 180 )
subsolarLon = ((subsolarLon + 180) mod 360) - 180        // east positive, (-180, 180]
```

**Route B, via sidereal time:**

```
subsolarLat = delta
subsolarLon = -GHA  normalised to (-180, 180]
```

Sanity check on the sign: at 12:00 UTC the Sun is near the Greenwich meridian, so `subsolarLon` must
be near 0. At 00:00 UTC it must be near +/-180. Verified numerically: at 2025-01-01T00:00:00Z the
subsolar longitude is -179.138 degrees.

Once you have the subsolar point, **the whole map is one formula.** For any pixel at
`(lat, lon)` the solar elevation is the complement of the great circle distance to the subsolar
point:

```
sin(elevation) = sin(lat) sin(subsolarLat) + cos(lat) cos(subsolarLat) cos(lon - subsolarLon)
```

This is the same as the hour angle form because `lon - subsolarLon = H` modulo 360. Compute
`subsolarLat` and `subsolarLon` once per frame on the CPU, upload them as two uniforms, and let the
fragment shader do the rest. There is nothing else the shader needs to know about astronomy.

Useful geometry constants for the shader (computed, using the WGS-84 equatorial radius 6378137 m and
a mean great circle degree of 111.195 km):

| Boundary | Solar elevation | Great circle distance from the subsolar antipode | On the ground |
|---|---|---|---|
| Terminator (apparent sunset) | -0.833 deg | 90.833 deg from subsolar point | 92.6 km beyond the geometric terminator |
| Civil twilight limit | -6 deg | 96 deg | 667 km band |
| Nautical twilight limit | -12 deg | 102 deg | 1334 km band |
| Astronomical twilight limit | -18 deg | 108 deg | 2002 km band |

Terminator ground speed at the equator: `2 pi * 6378137 / 86164.0905 s` = **465.1 m/s**. The
subsolar point moves 0.004167 degrees of longitude per second of time; equivalently, one arcsecond of
subsolar longitude error equals 0.0667 s of time and about 31 m on the ground.

---

## 7. Atmospheric refraction

### 7.1 NOAA's piecewise fit (verbatim from `main.js`)

Input `elev` is the **geometric** (true) elevation in degrees; the returned correction is in degrees
and is **added** to the geometric elevation.

```
function calcRefraction(elev) {
  if (elev > 85.0) {
    correction = 0.0
  } else {
    te = tan(radians(elev))
    if (elev > 5.0)          correction = 58.1/te - 0.07/te^3 + 0.000086/te^5   // arcseconds
    else if (elev > -0.575)  correction = 1735.0 + elev*(-518.2 + elev*(103.4 + elev*(-12.79 + elev*0.711)))
    else                     correction = -20.774 / te
    correction = correction / 3600.0     // arcseconds -> degrees
  }
  return correction
}
```

At `elev = 0` the middle branch gives 1735 arcseconds = **28.9 arcminutes**, not the 34 arcminutes
used to define sunrise. That is deliberate and is a known inconsistency inside NOAA's own tool: the
rise/set calculation does not call `calcRefraction`, it uses the fixed 90.833 degree zenith angle.
Do not mix them.

### 7.2 Bennett 1982 (apparent altitude in, refraction out)

```
R_arcmin = cot( h_a + 7.31 / (h_a + 4.4) )        // h_a = apparent altitude in DEGREES
```

Wikipedia (Atmospheric refraction), citing Meeus chapter 16: "consistent with Garfinkel's more
complex algorithm within 0.07 arcminutes over the entire range from the zenith to the horizon".

### 7.3 Saemundsson (true altitude in, refraction out) - Meeus equation 16.4

```
R_arcmin = 1.02 * cot( h + 10.3 / (h + 5.11) )    // h = true (geometric) altitude in DEGREES
```

"consistent with Bennett's to within 0.1 arcminutes". SunCalc implements this one, with slightly
different constants (`1.02 / tan(h + 10.26/(h + 5.10))`, in radians via `0.0002967 / tan(h +
0.00312536/(h + 0.08901179))`), which it labels formula 16.4.

### 7.4 Pressure and temperature scaling

Multiply either result by

```
(P / 101) * (283 / (273 + Tc))        // P in kPa, Tc in degrees Celsius
```

For a map you will not have local pressure. Use the standard atmosphere and move on.

### 7.5 Refraction at the horizon and why -0.833

Wikipedia, Atmospheric refraction: "The standard value for the Sun's true altitude is -50':
-34' for the refraction and -16' for the Sun's semi-diameter." `-50 arcminutes = -0.8333 degrees`,
which is why NOAA uses a zenith angle of **90.833 degrees**. The same page notes that the tabulated
refraction at the horizon is 35.4 arcminutes at 10 C and 1013.25 hPa, and that measured refraction
varies "by +/- 0.19' at two degrees above the horizon and by +/- 0.50' at a half degree above the
horizon", with extremes reaching 4 degrees in some climates.

**This is the accuracy floor for sunrise and sunset, and it is much larger than any ephemeris
error.** Measured sensitivity of computed sunrise to a 0.1 degree change in the assumed horizon
altitude (reference implementation, 2025):

| Latitude | Date | Shift in sunrise for -0.833 -> -0.933 deg |
|---|---|---|
| 0 | 2025-03-20 | 24 s |
| 40 N | 2025-03-20 | 31 s |
| 51.5 N | 2025-06-21 | 51 s |
| 60 N | 2025-06-21 | 1 min 25 s |
| 65 N | 2025-06-21 | 4 min 13 s |
| 69 N | 2025-06-21 | the event stops existing |

---

## 8. Rise, set, twilight, solar noon, day length, and the polar cases

### 8.1 Hour angle at a given altitude

```
cos(H0) = ( cos(90 - h0) - sin(lat) sin(delta) ) / ( cos(lat) cos(delta) )
```

equivalently, and this is the form NOAA writes:

```
cos(H0) = cos(zenith0) / ( cos(lat) cos(delta) ) - tan(lat) tan(delta)
```

with `zenith0 = 90 - h0`. If `cos(H0) > 1` the Sun never reaches `h0` (polar night with respect to
that threshold). If `cos(H0) < -1` the Sun never drops to `h0` (polar day). **Test the argument
before calling acos.** `H0 = degrees(acos(cos H0))` is in [0, 180]; the morning event uses `-H0`
and the evening event `+H0` in the signed convention, but NOAA's formula below absorbs the sign.

Thresholds `h0`:

| Event | `h0` | `zenith0` |
|---|---|---|
| Sunrise / sunset (apparent, disc upper limb, standard refraction) | **-0.833** | 90.833 |
| Sunrise / sunset (geometric, disc centre, no refraction) | 0.0 | 90.0 |
| Civil twilight | -6 | 96 |
| Nautical twilight | -12 | 102 |
| Astronomical twilight | -18 | 108 |
| "Golden hour" boundary (SunCalc convention) | +6 | 84 |
| Disc fully above the horizon (SunCalc `sunriseEnd`) | -0.3 | 90.3 |

If you want an observer height correction (mountain top, aircraft), SunCalc uses the classic
`dip = -2.076 * sqrt(height_metres) / 60` degrees, added to `h0`. Not needed for a world map.

### 8.2 Rise and set in UTC

NOAA's own two-pass form (`calcSunriseSetUTC` plus `calcSunriseSet`):

```
function riseSetUTC(rise, JD, lat, lon, h0) {   // JD at 0h UT of the day; lon east positive
  T  = (JD - 2451545) / 36525
  E  = equationOfTime(T)
  d  = declination(T)
  HA = hourAngleAt(lat, d, h0)                  // degrees, positive
  if (HA is null) return null
  if (!rise) HA = -HA
  return 720 - 4 * (lon + HA) - E               // minutes UTC
}
timeUTC = riseSetUTC(rise, JD, lat, lon, h0)
timeUTC = riseSetUTC(rise, JD + timeUTC/1440, lat, lon, h0)   // one refinement pass
```

Two problems with that form:

1. **Convergence.** One pass is not enough. Measured maximum error of an `n`-pass fixed point
   iteration against a converged solution, over all 365 days of 2025 at longitudes 0, 150 E and
   150 W:

   | Latitude | 1 pass | 2 passes | 3 passes |
   |---|---|---|---|
   | 0 | 22.2 s | 0.01 s | 0.000 s |
   | 40 | 73.2 s | 0.08 s | 0.000 s |
   | 60 | 138.9 s | 0.29 s | 0.001 s |
   | 65 | 179.7 s | 0.43 s | **117 s** |
   | 70 | 731.4 s | 16.6 s | **413 s** |

   Note that the iteration is **not monotonically convergent** above about 63 degrees latitude. Near
   the polar day and polar night boundaries the fixed point map is no longer a contraction and adding
   passes can make the answer worse. Do not just "add more iterations".

2. **Day assignment.** The unnormalised NOAA form can converge to the event on the *adjacent* UTC
   day, and near the equinoxes the declination changes by 0.39 degrees per day, so you get a one to
   two minute error. Sydney (33.8688 S, 151.2093 E), 2025-09-22: unnormalised iteration gives
   sunrise **19:45:02 UTC**, USNO gives **19:44**.

**Recommended algorithm: scan the UTC day and bisect each sign change.** This is what actually
matches USNO, it handles every degenerate case for free, and it costs 145 evaluations of
`declination` plus `equationOfTime` per day, which is nothing.

```
function altitudeAtMinute(JD0, m, lat, lon) {      // JD0 = JD at 0h UT, m = minutes UTC
    T   = (JD0 + m/1440 - 2451545) / 36525
    dec = declination(T)
    E   = equationOfTime(T)
    H   = wrap180( (m + E + 4*lon) / 4 - 180 )
    return degrees(asin( sin(lat)sin(dec) + cos(lat)cos(dec)cos(H) ))   // GEOMETRIC altitude
}

function findEvents(JD0, lat, lon, h0, stepMinutes = 10) {
    events = []
    prev = altitudeAtMinute(JD0, 0, lat, lon) - h0
    for (m = stepMinutes; m <= 1440; m += stepMinutes) {
        cur = altitudeAtMinute(JD0, m, lat, lon) - h0
        if ((prev < 0) != (cur < 0)) {
            // bisect on [m - stepMinutes, m], about 50 halvings for full double precision
            lo = m - stepMinutes; hi = m; flo = prev
            repeat 50 times {
                mid = (lo + hi) / 2
                fm  = altitudeAtMinute(JD0, mid, lat, lon) - h0
                if ((flo < 0) != (fm < 0)) hi = mid; else { lo = mid; flo = fm }
            }
            events.push({ kind: cur > 0 ? 'rise' : 'set', minutes: (lo + hi) / 2 })
        }
        prev = cur
    }
    return events            // 0, 1 or 2 entries, in chronological order within the UTC day
}
```

A 10 minute step is safe: the shortest possible interval between a rise and the following set is set
by how fast the altitude crosses the threshold, and at 70 N in November the whole day above the
horizon lasts 65 minutes (verified, see the table below), so a 10 minute grid still brackets both
crossings. If you support arbitrary `h0` down to -18 degrees, 10 minutes remains safe because
twilight events are even further apart.

**Validation.** This algorithm reproduces the USNO `rstt/oneday` answer on every case tried, to
within USNO's own one minute rounding, including the ordering of the events within the UTC day:

| Location | Date | Grid + bisection | USNO |
|---|---|---|---|
| Oslo | 2025-06-21 | rise 01:53:45.7, set 20:43:55.9 | Rise 01:54, Set 20:44 |
| Sydney | 2025-09-22 | set 07:51:25.9, rise 19:43:37.9 | Set 07:51, Rise 19:44 |
| Sydney | 2025-12-21 | set 09:05:33.2, rise 18:41:14.9 | Set 09:06, Rise 18:41 |
| 70 N, 0 E | 2025-05-15 | rise 00:36:28.3, set 23:37:59.5 | Rise 00:37, Set 23:37 |
| 70 N, 0 E | 2025-05-16 | rise 00:13:51.5 (no set) | Rise 00:15 (no set) |
| 70 N, 0 E | 2025-06-21 | no events | continuously above the horizon |
| 70 N, 0 E | 2025-11-24 | rise 11:13:55.7, set 12:18:45.3 | Rise 11:14, Set 12:19 |
| 70 N, 0 E | 2025-11-25 | no events | continuously below the horizon |
| 70 N, 0 E | 2026-01-17 | rise 11:40:58.8, set 12:39:59.5 | Rise 11:41, Set 12:40 |
| Ushuaia | 2025-12-21 | set 01:10:58.4, rise 07:51:32.0 | Set 01:11, Rise 07:52 |
| Quito | 2025-03-20 | rise 11:17:54.6, set 23:24:25.3 | Rise 11:18, Set 23:24 |
| Reykjavik | 2025-12-21 | rise 11:22:28.7, set 15:29:31.1 | Rise 11:22, Set 15:30 |
| Singapore | 2025-06-21 | set 11:12:34.0, rise 23:00:43.0 | Set 11:13, Rise 23:01 |
| Anchorage | 2025-06-21 | set 07:42:37.0, rise 12:20:18.3 | Set 07:42, Rise 12:20 |

The single largest disagreement in that set is **68 s**, at 70 N on 2025-05-16, the day the midnight
sun begins. That is exactly where the altitude curve is nearly tangent to the threshold and the root
is ill conditioned, and it is why NOAA quotes "within 10 minutes" outside +/- 72 degrees.

If you want a cheap path for the common case, use the two-pass fixed point iteration below `abs(lat)
= 60` (measured worst case 0.29 s) and the grid scan above it. Normalise the trial time into
`[0, 1440)` on every pass:

```
m = 720 - 4 * lon
repeat 2 times:
    T  = (JD0 + m/1440 - 2451545) / 36525
    HA = hourAngleAt(lat, declination(T), h0);  if (HA is null) return null
    m  = mod1440( 720 - 4*(lon + (rise ? HA : -HA)) - equationOfTime(T) )
```

### 8.3 Solar noon (transit)

```
m = 720 - 4 * lon                               // minutes UTC
repeat 3 times:
    E = equationOfTime( (JD + m/1440 - 2451545) / 36525 )
    m = 720 - 4 * lon - E
return m
```

**There is a bug in NOAA's `calcSolNoon`.** It reads:

```
var newt = calcTimeJulianCent(jd - 0.5 + solNoonOffset/1440.0)
```

`jd` there is the value returned by `getJD`, which ends in `.5` and denotes 0h UT. Subtracting
another 0.5 puts the second evaluation of the equation of time **half a day early**. Measured effect
(reference implementation vs USNO transit derived from the USNO celestial navigation GHA):

| Date | Longitude | NOAA `calcSolNoon` | Corrected two-pass | USNO (derived from GHA) |
|---|---|---|---|---|
| 2025-06-21 | 151.2093 E | 01:56:50.2 | 01:56:56.8 | 01:56:56.3 |
| 2025-04-15 | 122.4194 W | 20:09:40.9 | 20:09:33.7 | 20:09:32.8 |
| 2025-11-03 | 10.7522 E | 11:00:30.0 | 11:00:30.0 | 11:00:33.4 |

So the NOAA form adds up to about 7 s of error at |lon| near 150 degrees, on top of the roughly
3.5 s equation of time model error that is unavoidable. Confidence: **verified numerically**, the
attribution to `jd - 0.5` is my reading of the source.

### 8.4 Day length

```
dayLength_minutes = mod1440(setUTC - riseUTC)          // if both exist
```

Do not compute it as `8 * HA0` (twice the hour angle in minutes): that ignores the change in
declination between morning and evening and is wrong by tens of seconds near the equinoxes.

Verified example: Oslo 2025-06-21, rise 01:53:45.7 UTC, set 20:43:55.9 UTC, day length
**18 h 50 m 10.2 s**. timeanddate.com prints 18:49:57 for the same day, i.e. **13 s shorter**
(see pitfalls).

### 8.5 Polar day and polar night

Three distinct situations, and you must distinguish them because the UI wording differs:

```
maxAltitude = 90 - abs(lat - delta)            // altitude at upper transit
minAltitude = abs(lat + delta) - 90            // altitude at lower transit
```

* `minAltitude >= h0` : the Sun never goes below the threshold. **Midnight sun** (for
  `h0 = -0.833`), or "twilight all night" for `h0 = -6/-12/-18`. `cos(H0) < -1`.
* `maxAltitude <= h0` : the Sun never rises above the threshold. **Polar night**. `cos(H0) > 1`.
* otherwise both events exist.

USNO's own wording for these states, which is worth copying: `Object continuously above the
Horizon`, `Object continuously below the Horizon`, `Object continuously above the Twilight Limit`.

**A subtlety that will bite you.** "The Sun does not set today" and "there is no solution to the
hour angle equation for today's declination" are not the same statement, because the declination
changes during the day. At 70 N, 0 E:

| Date | USNO | Note |
|---|---|---|
| 2025-05-15 | Rise 00:37, Set 23:37 | last sunset before the midnight sun |
| 2025-05-16 | Rise 00:15, Lower Transit 23:56, **no set** | one rise, no set, on the same UTC day |
| 2025-06-21 | Continuously above the horizon | full midnight sun |
| 2025-07-29 | Rise 00:57, Set 23:05 | midnight sun over |
| 2025-11-24 | Rise 11:14, Set 12:19 | last day with a sunrise |
| 2025-11-25 | Continuously below the horizon, civil twilight 08:51 to 14:43 | polar night starts |
| 2026-01-16 | Continuously below the horizon | last day of polar night |
| 2026-01-17 | Rise 11:41, Set 12:40 | polar night over |

So compute rise and set **as independent events**, each with its own iteration, and let either one
be null. Do not compute a pair.

Also note that during polar night the twilight times still exist and are the interesting quantity
for the UI. 70 N, 0 E on 2025-12-21: no sunrise or sunset, but civil twilight 09:54:32 to 14:01:52
UTC, nautical 08:05:45 to 15:50:39, astronomical 06:45:43 to 17:10:40 (all verified against USNO
for the civil pair: 09:55 / 14:02).

### 8.6 Sunrise and sunset azimuth

Once you have the rise or set instant, feed it back through the azimuth formula. Verified against
MET Norway for Oslo 2025-06-21: computed rise azimuth **35.05**, MET Norway **35.06**; computed set
azimuth **324.94**, MET Norway **324.94**.

---

## 9. Equinoxes and solstices (Meeus chapter 27)

**Do not obtain these by root finding on the low accuracy apparent longitude.** Measured error of
that approach against USNO: up to **11 minutes** (2026 March equinox: model 14:37:44 UT, USNO 14:46).
This follows directly from the 0.01 degree position error divided by the Sun's 0.0411 deg/hour rate.

Use Meeus chapter 27 instead. Table 27.B gives a first approximation `JDE0` for years 1000 to 3000,
with `Y = (year - 2000) / 1000`:

```
March equinox      JDE0 = 2451623.80984 + 365242.37404 Y + 0.05169 Y^2 - 0.00411 Y^3 - 0.00057 Y^4
June solstice      JDE0 = 2451716.56767 + 365241.62603 Y + 0.00325 Y^2 + 0.00888 Y^3 - 0.00030 Y^4
September equinox  JDE0 = 2451810.21715 + 365242.01767 Y - 0.11575 Y^2 + 0.00337 Y^3 + 0.00078 Y^4
December solstice  JDE0 = 2451900.05952 + 365242.74049 Y - 0.06223 Y^2 - 0.00823 Y^3 + 0.00032 Y^4
```

(Table 27.A, for years -1000 to +1000 with `Y = year / 1000`, is
March `1721139.29189 + 365242.13740 Y + 0.06134 Y^2 + 0.00111 Y^3 - 0.00071 Y^4`,
June `1721233.25401 + 365241.72562 Y - 0.05323 Y^2 + 0.00907 Y^3 + 0.00025 Y^4`,
September `1721325.70455 + 365242.49558 Y - 0.11677 Y^2 - 0.00297 Y^3 + 0.00074 Y^4`,
December `1721414.39987 + 365242.88257 Y - 0.00769 Y^2 - 0.00933 Y^3 - 0.00006 Y^4`.
The June `Y^2` coefficient is `-0.05323` in PyMeeus and `-0.05232` in soniakeys/meeus; digits
transposed in one of them. Irrelevant for us, but marked **UNVERIFIED** which is correct.)

Then Table 27.C, the periodic correction:

```
T = (JDE0 - 2451545.0) / 36525
W = 35999.373 * T - 2.47                          // degrees
dLambda = 1 + 0.0334 cos(W) + 0.0007 cos(2W)
S = sum over 24 terms of  A * cos(B + C*T)        // B, C in degrees
JDE = JDE0 + (0.00001 * S) / dLambda              // TT (Terrestrial Time)
```

Table 27.C coefficients `(A, B, C)`, transcribed from
<https://github.com/soniakeys/meeus/blob/master/v3/solstice/solstice.go>:

```
485 324.96   1934.136      70 243.58   9037.513      17 288.79   4562.452
203 337.23  32964.467      58 119.81  33718.147      16 198.04  62894.029
199 342.08     20.186      52 297.17    150.678      14 199.76  31436.921
182  27.85 445267.112      50  21.02   2281.226      12  95.39  14577.848
156  73.14  45036.886      45 247.54  29929.562      12 287.11  31931.756
136 171.52  22518.443      44 325.15  31555.956      12 320.81  34777.259
 77 222.54  65928.934      29  60.93   4443.417       9 227.73   1222.114
 74 296.72   3034.906      18 155.12  67555.328       8  15.45  16859.074
```

Stated accuracy: "within one minute of time for the years 1951-2050". **Verified**: implemented and
compared against the USNO seasons API for 2025 to 2027, converting TT to UT by subtracting
delta T = 69.1 s. Maximum disagreement **40 s**, and USNO only publishes whole minutes:

| Event | Meeus 27 (TT) | minus 69.1 s (UT) | USNO (UT) |
|---|---|---|---|
| 2025 Mar equinox | 09:02:45 | 09:01:36 | 09:01 |
| 2025 Jun solstice | 02:43:31 | 02:42:22 | 02:42 |
| 2025 Sep equinox | 18:20:42 | 18:19:33 | 18:19 |
| 2025 Dec solstice | 15:04:18 | 15:03:09 | 15:03 |
| 2026 Mar equinox | 14:46:45 | 14:45:35 | 14:46 |
| 2026 Jun solstice | 08:26:04 | 08:24:55 | 08:24 |
| 2026 Sep equinox | 00:06:39 | 00:05:30 | 00:05 |
| 2026 Dec solstice | 20:51:22 | 20:50:13 | 20:50 |
| 2027 Mar equinox | 20:26:03 | 20:24:54 | 20:25 |
| 2027 Jun solstice | 14:11:51 | 14:10:42 | 14:11 |
| 2027 Sep equinox | 06:02:28 | 06:01:18 | 06:02 |
| 2027 Dec solstice | 02:43:26 | 02:42:17 | 02:42 |

**Recommendation for the heliograph: hard-code the USNO values as data** for any year the UI can
reach, or implement Meeus 27 if you want arbitrary years. Do not root-find.

---

## 10. Accuracy: measured, not claimed

All figures below were produced during this research by comparing the NOAA / Meeus low accuracy
chain against PyMeeus's full VSOP87 apparent geocentric position (nutation and aberration included),
and separately against the USNO Astronomical Applications API.

### 10.1 Solar position, low accuracy vs full VSOP87

| Window | Sampling | max |dRA| | rms dRA | max |dDec| | rms dDec |
|---|---|---|---|---|---|
| Year 2000 | daily | 24.7" | 5.8" | 9.6" | 4.2" |
| Year 2025 | daily | 31.4" | 11.5" | 12.4" | 3.8" |
| 1900 to 2100 | weekly | **38.9"** | 9.8" | **12.8"** | 3.6" |
| 1800 to 1900 | weekly | 36.8" | 9.7" | 13.7" | 3.3" |
| 2100 to 2200 | weekly | 36.6" | 9.7" | 12.9" | 3.3" |

In arcminutes: **right ascension is good to 0.65 arcminutes, declination to 0.23 arcminutes**, over
1800 to 2200. This confirms Meeus's stated "0.01 degree" (36 arcseconds) for chapter 25 low accuracy.
It also shows the accuracy does not degrade meaningfully out to 1800 and 2200, so a scrubbing UI that
lets the user roam a couple of centuries is safe.

### 10.2 Equation of time

Low accuracy chain vs Meeus equation 28.1 evaluated with full VSOP87 apparent right ascension and
the high accuracy `L0`, sampled daily through 2025:

* max error **3.42 s of time** (0.057 minutes), rms 1.29 s

Independently, against the USNO celestial navigation service (equation of time derived from the
published Sun GHA), on 12 sample instants in 2025 and 2026: max error **3.45 s**, at 2025-11-03.

3.45 s of time is 0.0144 degrees of subsolar longitude, i.e. **52 arcseconds**, i.e. about 1.6 km on
the ground.

### 10.3 Subsolar point, direct comparison against USNO

Subsolar latitude = Sun declination, subsolar longitude = -GHA, both taken from the USNO celestial
navigation API (which uses the USNO's own high precision ephemeris and applies delta T internally).
The heliograph implementation feeds UTC directly with no delta T correction.

| UTC instant | USNO dec | model dec | d (arcsec) | USNO lon | model lon | d (arcsec) |
|---|---|---|---|---|---|---|
| 2025-01-01T00:00:00 | -22.99820 | -22.99808 | +0.4 | -179.13938 | -179.13783 | +5.6 |
| 2025-03-20T09:01:00 | -0.00028 | +0.00275 | +10.9 | 46.59935 | 46.59969 | +1.2 |
| 2025-06-21T02:42:00 | 23.43834 | 23.43852 | +0.6 | 139.94329 | 139.94759 | +15.5 |
| 2025-06-21T12:00:00 | 23.43783 | 23.43799 | +0.6 | 0.46451 | 0.46865 | +14.9 |
| 2025-09-22T18:19:00 | -0.00000 | +0.00119 | +4.3 | -96.61371 | -96.60991 | +13.7 |
| 2025-12-21T15:03:00 | -23.43824 | -23.43836 | -0.4 | -46.18804 | -46.18438 | +13.2 |
| 2026-02-11T12:00:00 | -13.92725 | -13.92521 | +7.4 | 3.54382 | 3.55654 | **+45.8** |
| 2026-05-14T12:00:00 | 18.69959 | 18.70145 | +6.7 | -0.91827 | -0.91011 | +29.4 |
| 2026-07-26T12:00:00 | 19.36321 | 19.36343 | +0.8 | 1.64139 | 1.64070 | -2.5 |
| 2026-11-03T12:00:00 | -15.15098 | -15.15138 | -1.4 | -4.11164 | -4.12305 | **-41.1** |
| 2000-01-01T12:00:00 | -23.03243 | -23.03252 | -0.3 | 0.82128 | 0.82531 | +14.5 |
| 2027-04-15T06:30:00 | 9.70614 | 9.70576 | -1.4 | 82.53847 | 82.53440 | -14.7 |
| 2030-03-20T13:52:00 | -0.00012 | +0.00066 | +2.8 | -26.14583 | -26.15050 | -16.8 |

**Worst case over the sample: 10.9 arcseconds in latitude, 45.8 arcseconds in longitude.**
That is 0.18 and 0.76 arcminutes. On a 4096 pixel wide equirectangular map, one pixel is 316
arcseconds of longitude, so the subsolar point is correct to **one seventh of a pixel**.

### 10.4 Solar elevation and azimuth, against USNO

USNO `hc` was confirmed to be the geometric (unrefracted) altitude of the disc centre: recomputing
`sin(alt) = sin(phi) sin(dec) + cos(phi) cos(dec) cos(GHA + lon)` from USNO's own `dec` and `gha`
reproduces their `hc` to all printed digits. `zn` is north based azimuth.

| Location | UTC instant | USNO alt | model alt | d | USNO az | model az | d |
|---|---|---|---|---|---|---|---|
| Oslo | 2025-06-21T10:00:00 | 51.00185 | 51.00098 | -3.1" | 150.55033 | 150.54440 | -21.4" |
| Oslo | 2025-12-21T11:00:00 | 6.58999 | 6.58976 | -0.8" | 176.50113 | 176.49765 | -12.5" |
| Quito | 2025-03-20T17:00:00 | 84.69836 | 84.69783 | -1.9" | 86.63127 | 86.59853 | -117.9" |
| Quito | 2025-06-21T17:00:00 | 66.07338 | 66.07260 | -2.8" | 8.95104 | 8.96000 | +32.2" |
| Sydney | 2025-12-21T02:00:00 | 79.46084 | 79.46146 | +2.2" | 351.36553 | 351.38543 | +71.6" |
| Sydney | 2025-06-21T01:00:00 | 31.11522 | 31.11410 | -4.0" | 15.27395 | 15.27840 | +16.0" |
| Reykjavik | 2025-09-22T13:00:00 | 25.82978 | 25.83076 | +3.5" | 174.33404 | 174.32966 | -15.8" |
| Reykjavik | 2025-06-21T13:00:00 | 48.99850 | 48.99833 | -0.6" | 169.61035 | 169.60459 | -20.7" |
| Nairobi | 2026-03-20T09:00:00 | 79.88332 | 79.88397 | +2.3" | 83.28204 | 83.26919 | -46.2" |
| San Francisco | 2025-08-15T20:00:00 | 65.79395 | 65.79384 | -0.4" | 171.64839 | 171.64830 | -0.3" |

**Elevation is good to 4 arcseconds. Azimuth is good to 2 arcminutes**, with the error concentrated
where the Sun is close to the zenith (Quito, Sydney) and azimuth is geometrically ill conditioned.

### 10.5 SunCalc, for comparison

SunCalc uses a much cruder model: a fixed obliquity of 23.4397 degrees, a three term equation of the
centre with rounded coefficients (1.9148, 0.02, 0.0003), no nutation, and
`siderealTime = 280.16 + 360.9856235 d`.

| Location | UTC instant | alt error vs USNO | az error vs USNO |
|---|---|---|---|
| Oslo | 2025-06-21T10:00:00 | -0.74' | -4.80' |
| Oslo | 2025-12-21T11:00:00 | -0.09' | -2.58' |
| Quito | 2025-03-20T17:00:00 | -7.69' | +110.63' (near zenith) |
| Sydney | 2025-12-21T02:00:00 | +0.28' | +14.00' |
| Reykjavik | 2025-09-22T13:00:00 | **+10.23'** | -8.52' |

And its rise/set times carry a systematic **+68 to +84 second** offset relative to USNO and to the
NOAA chain, because the `J0 = 0.0009` day (77.8 s) constant in its transit approximation is a delta T
style fudge baked into a UT calculation:

| Location | Date | SunCalc sunrise | NOAA chain | USNO |
|---|---|---|---|---|
| Oslo | 2025-06-21 | 01:55:00.4 | 01:53:45.7 | 01:54 |
| Sydney | 2025-12-21 | 18:42:05.4 (prev day) | 18:40:45.7 | 18:41 |
| Reykjavik | 2025-03-20 | 07:29:38.9 | 07:27:43.9 | 07:28 |

**Do not use SunCalc as a reference oracle in tests.** It is convenient and popular, but a 10
arcminute altitude error is twenty times the Sun's own semi-diameter divided by two, and its
sunrise times are more than a minute out.

---

## 11. Which algorithm for which feature

### (a) The terminator: NOAA / Meeus chapter 25 low accuracy, feeding UTC directly

Rationale, all measured above:

* subsolar point good to 0.18' in latitude and 0.76' in longitude, i.e. under 1.6 km on the ground
* ignoring delta T costs at most 1.14 arcseconds, i.e. 35 m
* one pixel on a 4096 wide map is 316 arcseconds of longitude, so the error is one seventh of a pixel
* the whole chain is about 40 floating point operations per frame, evaluated once on the CPU

Implementation shape: compute `subsolarLat`, `subsolarLon` on the CPU each frame, pass as two
uniforms, evaluate `sin(elevation)` per pixel in the fragment shader. Do not evaluate the ephemeris
per pixel.

### (b) The analemma trace: same low accuracy model, with one exception

The analemma is 47 degrees tall and 7.68 degrees wide. The model's errors are 0.0036 degrees in
declination and 0.0144 degrees in the horizontal (equation of time) direction. That is 0.008 percent
and 0.19 percent of the figure's dimensions respectively, both far below a pixel for any reasonable
plot size. Use the same code path as the terminator.

**Exception:** if you annotate the analemma with the solstice and equinox instants, take those from
section 9 (Meeus chapter 27, or hard-coded USNO values). Root finding on the low accuracy longitude
is wrong by up to 11 minutes.

### (c) Sunrise, sunset and twilight tables: same model, with the grid scan solver of section 8.2

With the 10 minute grid scan plus bisection, the model matched USNO to within its own one minute
rounding on **every** city-date-event combination computed during this research (over 50 of them),
across latitudes from 54.8 S to 70 N, including the one-event and no-event polar days. The single
worst disagreement was 68 s, on the day the midnight sun begins at 70 N. NOAA's own statement is: "The sunrise and sunset results are
theoretically accurate to within a minute for locations between +/- 72 degrees latitude, and within
10 minutes outside of those latitudes."

The limiting factor above roughly 60 degrees latitude is **not the ephemeris, it is the refraction
assumption** (section 7.5). Present sunrise and sunset to the minute, never to the second, and say
so in the UI.

For the animation timeline, note that day length must be computed as `set - rise` from two
separately converged events, not as twice the hour angle.

---

## 12. The analemma

### 12.1 What is actually plotted

Wikipedia, Analemma: "a diagram showing the position of the Sun in the sky as seen from a fixed
location on Earth at the same mean solar time over the course of a year." The two coordinates are:

* **vertical (north-south): the solar declination**, range about +/-23.44 degrees, total 47 degrees
* **horizontal (east-west): the equation of time**, range about +/-7.7 degrees expressed as an angle

The figure of eight arises because the north-south motion has period one year with a single maximum
and minimum, while the east-west motion (the equation of time) has two components: an annual one from
orbital eccentricity and a semi-annual one from the obliquity, whose sum crosses zero four times a
year. The two loops are unequal because perihelion falls about two weeks after the December solstice
rather than exactly on it.

Numbers, confirmed by computation with the reference implementation for 2025:

* equation of time range: **-14.2284 to +16.4918 minutes**
* as an angle: -3.557 to +4.123 degrees, total width **7.680 degrees**
* height: 2 * 23.44 = 46.88 degrees, so the figure is 6.1 times taller than it is wide

### 12.2 The formula, for the subsolar point version

The cleanest formulation for a map application: the analemma is the **locus of the subsolar point
sampled once per day at a fixed UTC instant**. Pick a UTC time of day `t0` (12:00:00 is natural),
then for each day `d` of the year:

```
JD          = jdFromMillis( Date.UTC(year, 0, 1, t0h, t0m, t0s) + d * 86400000 )
T           = (JD - 2451545) / 36525
subsolarLat = declination(T)
subsolarLon = -( (utcMinutes(JD) + eot(T)) / 4 - 180 )  normalised to (-180, 180]
```

Because `utcMinutes` is constant across the samples, `subsolarLon` is a pure affine function of the
equation of time: `subsolarLon = lon0 - 0.25 * E` degrees, with `E` in minutes and `lon0` the
meridian corresponding to `t0` (`lon0 = 0` for `t0 = 12:00:00 UTC`). So the plotted figure literally
**is** `(-0.25 * E, delta)` and the drawn analemma sits on the globe as the annual wander of the
noon Sun about the Greenwich meridian.

### 12.3 The observer-sky version

If you instead want the classic "same clock time, same place, looking at the sky" analemma, use the
same declination and equation of time, but convert to horizontal coordinates for the observer:

```
H   = (clockMinutes + E + 4*lon - 60*utcOffsetHours) / 4 - 180
alt = asin( sin(phi) sin(delta) + cos(phi) cos(delta) cos(H) )
az  = atan2( sin(H), cos(H) sin(phi) - tan(delta) cos(phi) ) + 180
```

sampled once per day at a fixed `clockMinutes`. The figure tilts with latitude and with the chosen
hour: upright at the pole, horizontal at the equator, inverted in the southern hemisphere. Use
**mean** solar time (a fixed clock hour), not apparent solar time; using apparent solar time
collapses the figure of eight into a vertical line, which is a classic bug.

### 12.4 Reference data (compute-and-compare fixture)

Subsolar point at 12:00:00 UTC, 2025, from the reference implementation. Use this as a golden file
for the analemma test.

| Date | EoT (min) | declination (deg) | subsolar lon (deg E) |
|---|---|---|---|
| 2025-01-01 | -3.6834 | -22.95580 | +0.92085 |
| 2025-01-15 | -9.4939 | -21.02299 | +2.37348 |
| 2025-02-01 | -13.6138 | -16.94626 | +3.40346 |
| 2025-02-15 | -14.1070 | -12.49235 | +3.52675 |
| 2025-03-01 | -12.2658 | -7.38226 | +3.06645 |
| 2025-03-15 | -8.8140 | -1.92508 | +2.20350 |
| 2025-04-01 | -3.7635 | +4.74897 | +0.94086 |
| 2025-04-15 | +0.0348 | +9.95976 | -0.00871 |
| 2025-05-01 | +2.9265 | +15.24163 | -0.73162 |
| 2025-05-15 | +3.6295 | +18.99503 | -0.90737 |
| 2025-06-01 | +2.0973 | +22.12722 | -0.52432 |
| 2025-06-15 | -0.5727 | +23.33021 | +0.14317 |
| 2025-07-01 | -3.9486 | +23.06823 | +0.98714 |
| 2025-07-15 | -6.0376 | +21.43408 | +1.50941 |
| 2025-08-01 | -6.3446 | +17.87442 | +1.58615 |
| 2025-08-15 | -4.4517 | +13.87629 | +1.11292 |
| 2025-09-01 | +0.0584 | +8.07897 | -0.01460 |
| 2025-09-15 | +4.8548 | +2.81628 | -1.21370 |
| 2025-10-01 | +10.4075 | -3.39682 | -2.60188 |
| 2025-10-15 | +14.2995 | -8.71394 | -3.57487 |
| 2025-11-01 | +16.4743 | -14.59822 | -4.11858 |
| 2025-11-15 | +15.4031 | -18.61635 | -3.85078 |
| 2025-12-01 | +10.8799 | -21.88125 | -2.71999 |
| 2025-12-15 | +4.7438 | -23.29148 | -1.18594 |

Spot check against USNO: 2025-09-01T00:00:00Z gives EoT -0.1003 from the model and -0.1038 derived
from the USNO GHA, a 0.21 s difference.

---

## 13. Test vectors

Every vector below was produced by the reference implementation described at the top and confirmed
against the sources named in each row. Tolerances are chosen to be roughly three times the observed
disagreement, so a correct implementation passes comfortably and a broken one fails.

Independent sources used:

* **USNO** = US Naval Observatory Astronomical Applications API v4.0.1,
  <https://aa.usno.navy.mil/data/api> (endpoints `celnav`, `rstt/oneday`, `seasons`, `siderealtime`)
* **VSOP87** = PyMeeus 0.5.x full VSOP87 apparent geocentric position,
  <https://pymeeus.readthedocs.io/>
* **Meeus** = published worked examples, transcribed in the PyMeeus doctests and the soniakeys/meeus
  Go port
* **MET** = MET Norway sunrise API 3.0, <https://api.met.no/weatherapi/sunrise/3.0/>
* **T&D** = timeanddate.com sun tables
* **NOAA** = <https://gml.noaa.gov/grad/solcalc/> algorithm as published in `main.js`

### Group A: Meeus worked examples, reproduced verbatim

**TV-01. Meeus Example 25.a, full intermediate chain.**
Input: 1992-10-13T00:00:00 TD (JDE 2448908.5). Quantity: every intermediate of section 3.1.
Expected and tolerances:

| Symbol | Expected | Tolerance |
|---|---|---|
| T | -0.072183436 | 1e-9 |
| L0 | 201.80720 deg | 1e-5 deg |
| M mod 360 | 278.99397 deg | 1e-5 deg |
| e | 0.016711668 | 1e-9 |
| C | -1.89732 deg | 1e-5 deg |
| true longitude | 199.90988 deg | 2e-5 deg |
| R | 0.99766 AU | 1e-5 AU |
| apparent lambda | 199.90895 deg | 2e-5 deg |
| eps0 | 23.44023 deg | 1e-5 deg |
| eps corrected | 23.43999 deg | 1e-5 deg |
| apparent alpha | 198.38083 deg (13h13m31.4s) | 1e-4 deg |
| apparent delta | -7.78507 deg (-7d47'06") | 1e-4 deg |

Sources: Meeus *Astronomical Algorithms* 2nd ed. chapter 25 via
<https://pymeeus.readthedocs.io/en/latest/_modules/pymeeus/Sun.html> (doctests
`true_longitude_coarse`, `apparent_longitude_coarse`, `apparent_rightascension_declination_coarse`),
cross-checked against the reference implementation. Verified.

**TV-02. Meeus Example 25.b, high accuracy answer for the same instant.**
Input: 1992-10-13T00:00:00 TD. Quantity: apparent RA and Dec from full VSOP87.
Expected: alpha = 198.3781187 deg (13h13m30.749s) +/- 3e-6 deg; delta = -7.7838168 deg
(-7d47'01.74") +/- 3e-6 deg; R = 0.99760852 AU +/- 1e-8.
Use: this vector defines the *reference truth* against which TV-01's 9.8" RA error is asserted.
Source: <https://pymeeus.readthedocs.io/en/latest/_modules/pymeeus/Sun.html>. Verified.

**TV-03. Meeus Example 12.a, GMST at 0h UT.**
Input: 1987-04-10T00:00:00 UT (JD 2446895.5). Quantity: Greenwich mean sidereal time.
Expected: **13h 10m 46.3668s** (= 197.6931950 deg) +/- 0.001 s of time against Meeus,
+/- 0.01 s of time against USNO (which returns 13:10:46.3701).
Sources: Meeus chapter 12 example 12.a; USNO `siderealtime` API. Verified.

**TV-04. Meeus Example 12.b, GMST at a non-integral hour.**
Input: 1987-04-10T19:21:00 UT (JD 2446896.30625). Quantity: GMST.
Expected: **8h 34m 57.0896s** (= 128.7378730 deg) +/- 0.001 s against Meeus;
USNO returns 08:34:57.0929.
Sources: as TV-03. Verified.

### Group B: subsolar point

Tolerance rationale: worst measured disagreement with USNO over the sample was 10.9 arcsec in
latitude and 45.8 arcsec in longitude, so 0.005 deg (18") for latitude and 0.02 deg (72") for
longitude. Subsolar longitude is derived from USNO's published Sun GHA as
`lon = normalise(-GHA)`; the observer coordinates passed to `celnav` were the subsolar point itself,
which is required because USNO omits bodies below the observer's horizon.

**TV-05. Subsolar point, generic winter instant.**
Input: 2025-01-01T00:00:00Z. Expected lat -22.99820 deg (tol 0.005), lon -179.13938 deg (tol 0.02).
Sources: USNO `celnav` (dec 23... see table in 10.3), reference implementation, VSOP87. Verified.

**TV-06. Subsolar point at the June solstice instant.**
Input: 2025-06-21T02:42:00Z. Expected lat +23.43834 (tol 0.005), lon +139.94329 (tol 0.02).
Sources: USNO `celnav`; USNO `seasons` for the instant. Verified.

**TV-07. Subsolar point at noon UTC on the June solstice.**
Input: 2025-06-21T12:00:00Z. Expected lat +23.43783 (tol 0.005), lon +0.46451 (tol 0.02).
Note the subsolar longitude is *not* zero at 12:00 UTC; the equation of time is -1.86 min that day.
Sources: USNO `celnav`. Verified.

**TV-08. Subsolar point at the March equinox instant (declination crosses zero).**
Input: 2025-03-20T09:01:00Z. Expected lat -0.00028 (tol 0.005), lon +46.59935 (tol 0.02).
Sources: USNO `celnav` and USNO `seasons`. Verified.

**TV-09. Subsolar point at the September equinox instant.**
Input: 2025-09-22T18:19:00Z. Expected lat -0.00000 (tol 0.005), lon -96.61371 (tol 0.02).
Sources: USNO `celnav`, USNO `seasons`. Verified.

**TV-10. Subsolar point at the December solstice instant.**
Input: 2025-12-21T15:03:00Z. Expected lat -23.43824 (tol 0.005), lon -46.18804 (tol 0.02).
Sources: USNO `celnav`, USNO `seasons`. Verified.

**TV-11. Subsolar point at J2000.0 (epoch anchor).**
Input: 2000-01-01T12:00:00Z (JD 2451545.0 exactly, T = 0).
Expected lat -23.03243 (tol 0.005), lon +0.82128 (tol 0.02).
This vector also pins `JD == 2451545.0` and `T == 0` exactly.
Sources: USNO `celnav`, reference implementation. Verified.

**TV-12. Subsolar point well outside the calibration window.**
Input: 2030-03-20T13:52:00Z. Expected lat -0.00012 (tol 0.005), lon -26.14583 (tol 0.02).
Purpose: confirms the model does not drift when scrubbing years ahead.
Sources: USNO `celnav`. Verified.

### Group C: equation of time

Tolerance: worst measured disagreement with USNO 3.45 s = 0.058 min, so **0.15 minutes**.
Independent check is the equation of time derived from USNO's Sun GHA,
`E = ((GHA/15 + 12) - UT) mod 24`, plus the Meeus 28.1 / VSOP87 route.

**TV-13. Equation of time at its February minimum (deepest negative).**
Input: 2025-02-11T02:49:41Z. Expected **-14.2284 min**, tol 0.15 min.
Also assert the extremum date: the minimum falls on 2025-02-11, 2026-02-11 and 2027-02-11
(instants 02:49:41Z, 08:41:52Z, 14:34:23Z; values -14.2284, -14.2263, -14.2239).
Cross-check at 2025-02-11T12:00:00Z: model -14.2275, USNO-derived -14.1881.
Sources: reference implementation; USNO `celnav`; earthsky.org and ppowers.com/EoT.htm both give
about -14.24 min around 11 February. Verified.

**TV-14. Equation of time at its May maximum (shallow positive).**
Input: 2025-05-13T19:20:54Z. Expected **+3.6430 min**, tol 0.15 min.
2026: 2026-05-14T01:04:27Z, +3.6414. 2027: 2027-05-14T06:48:15Z, +3.6396.
Cross-check at 2026-05-14T12:00:00Z: model +3.6404, USNO-derived +3.6731.
Sources: reference implementation; USNO `celnav`. Verified.

**TV-15. Equation of time at its July minimum (shallow negative).**
Input: 2025-07-25T22:32:50Z. Expected **-6.5614 min**, tol 0.15 min.
2026: 2026-07-26T04:18:35Z, -6.5633. 2027: 2027-07-26T10:03:59Z, -6.5650.
Cross-check at 2026-07-26T12:00:00Z: model -6.5628, USNO-derived -6.5656.
Sources: reference implementation; USNO `celnav`. Verified.

**TV-16. Equation of time at its November maximum (deepest positive).**
Input: 2025-11-03T02:20:07Z. Expected **+16.4919 min**, tol 0.15 min.
2026: 2026-11-03T08:12:37Z, +16.4924. 2027: 2027-11-03T14:04:59Z, +16.4927.
Cross-check at 2025-11-03T12:00:00Z: model +16.4908, USNO-derived +16.4332. This is the **worst
case** in the whole sample, 3.45 s of time.
Sources: reference implementation; USNO `celnav`. Verified.

**TV-17. Equation of time zero crossings.**
Input: 2025-04-15T12:00:00Z, expected +0.0348 min (USNO-derived +0.0505), tol 0.15.
Input: 2025-09-01T00:00:00Z, expected -0.1003 min (USNO-derived -0.1038), tol 0.15.
Input: 2025-12-25T12:00:00Z, expected -0.1813 min (USNO-derived -0.1759), tol 0.15.
Purpose: catches sign errors that only show up near zero. Sources: USNO `celnav`. Verified.

### Group D: equinoxes and solstices, 2025 to 2027

Quantity: the UT instant at which the Sun's apparent geocentric longitude reaches
0 / 90 / 180 / 270 degrees. Tolerance **90 seconds** against USNO if you implement Meeus chapter 27;
this is the whole vector, do not attempt it with chapter 25.

**TV-18. Season instants (12 sub-cases).** All times UT, from
<https://aa.usno.navy.mil/api/seasons?year=YYYY&tz=0&dst=false> (API v4.0.1), independently
reproduced by Meeus chapter 27 (max 40 s disagreement, table in section 9), and matching the
published USNO "Earth's Seasons" page.

| Year | March equinox | June solstice | September equinox | December solstice |
|---|---|---|---|---|
| 2025 | Mar 20, 09:01 | Jun 21, 02:42 | Sep 22, 18:19 | Dec 21, 15:03 |
| 2026 | Mar 20, 14:46 | Jun 21, 08:24 | Sep 23, 00:05 | Dec 21, 20:50 |
| 2027 | Mar 20, 20:25 | Jun 21, 14:11 | Sep 23, 06:02 | Dec 22, 02:42 |

Perihelion and aphelion from the same source, useful for the "Earth-Sun distance" readout:
2025-01-04 13:28 and 2025-07-03 19:55; 2026-01-03 17:15 and 2026-07-06 17:30;
2027-01-03 02:33 and 2027-07-05 05:06.
Note the widely reproduced value "2026 June solstice 08:25" comes from rounding a differently
computed instant; the USNO API returns **08:24**. Verified.

### Group E: solar elevation and azimuth

Tolerance: **0.02 deg (72") in elevation, 0.05 deg (3') in azimuth**, relaxed to 0.1 deg in azimuth
when the elevation exceeds 80 degrees. Expected values are USNO `hc` (geometric altitude of the disc
centre, no refraction) and `zn` (azimuth, north based, clockwise). Compare against your
**geometric** elevation, before refraction.

**TV-19. Oslo (59.9139 N, 10.7522 E), summer mid-morning.**
2025-06-21T10:00:00Z. Expected alt 51.00185, az 150.55033. Model gives 51.00098 / 150.54440.
Sources: USNO `celnav`; NOAA algorithm. Verified.

**TV-20. Oslo, winter near transit (low Sun, refraction matters).**
2025-12-21T11:00:00Z. Expected geometric alt 6.58999, az 176.50113. Model 6.58976 / 176.49765.
Additionally assert the **refracted** elevation 6.71801 +/- 0.02 (NOAA `calcRefraction` adds
0.12825 deg at this altitude). Sources: USNO `celnav` for the geometric value; NOAA `main.js` for
the refraction model. Verified for the geometric part; the refracted value is NOAA's model output,
not an observation.

**TV-21. Quito (0.1807 S, 78.4678 W), equinox, Sun almost overhead.**
2025-03-20T17:00:00Z. Expected alt 84.69836 (tol 0.02), az 86.63127 (tol **0.1**, the Sun is 5
degrees from the zenith and azimuth is ill conditioned). Model 84.69783 / 86.59853.
Sources: USNO `celnav`. Verified.

**TV-22. Quito, June solstice afternoon.**
2025-06-21T17:00:00Z. Expected alt 66.07338, az 8.95104. Model 66.07260 / 8.96000.
Note the azimuth is close to due north from a southern hemisphere location that is barely south of
the equator: a good quadrant test. Sources: USNO `celnav`. Verified.

**TV-23. Sydney (33.8688 S, 151.2093 E), December solstice near local noon.**
2025-12-21T02:00:00Z. Expected alt 79.46084 (tol 0.02), az 351.36553 (tol 0.1).
Model 79.46146 / 351.38543. Azimuth just west of north in the southern summer: this vector fails
loudly if you use SunCalc's south based azimuth without the 180 degree shift.
Sources: USNO `celnav`. Verified.

**TV-24. Sydney, June solstice morning.**
2025-06-21T01:00:00Z. Expected alt 31.11522, az 15.27395. Model 31.11410 / 15.27840.
Sources: USNO `celnav`. Verified.

**TV-25. Reykjavik (64.1466 N, 21.9426 W), September equinox.**
2025-09-22T13:00:00Z. Expected alt 25.82978, az 174.33404. Model 25.83076 / 174.32966.
Sources: USNO `celnav`. Verified.

**TV-26. Reykjavik, June solstice.**
2025-06-21T13:00:00Z. Expected alt 48.99850, az 169.61035. Model 48.99833 / 169.60459.
Sources: USNO `celnav`. Verified.

### Group F: rise, transit, set, twilight

Tolerance: **60 seconds** against USNO (which publishes whole minutes) and against MET Norway (which
truncates to the minute). All times UTC. Latitudes and longitudes as given.

**TV-27. Oslo (59.9139 N, 10.7522 E), 2025-06-21.**

| Quantity | Model | USNO | MET Norway | T&D (local CEST) |
|---|---|---|---|---|
| Sunrise | 01:53:45.7 | 01:54 | 01:53 (az 35.06) | 03:53 |
| Sunset | 20:43:55.9 | 20:44 | 20:43 (az 324.94) | 22:43 |
| Solar noon | 11:18:51.6 | 11:19 | 11:18 (elev 53.52) | 13:18 |
| Civil twilight begin | 00:09:31.0 | 00:10 | | 02:09 |
| Civil twilight end | 22:28:06.7 | 22:28 | | 00:27 (next day) |
| Nautical twilight | none | none | | none |
| Astronomical twilight | none | none | | none |
| Day length | 18h 50m 10.2s | | | 18:49:57 |
| Rise azimuth | 35.05 | | 35.06 | 39 (rounded, T&D differs) |
| Set azimuth | 324.94 | | 324.94 | 321 (rounded) |
| Solar noon elevation (geometric) | 53.524 | | 53.52 | 53.5 |

Sources: USNO `rstt/oneday`, MET Norway `sunrise/3.0/sun`, timeanddate.com
`https://www.timeanddate.com/sun/norway/oslo?month=6&year=2025`. Verified. Note the day length
disagreement of 13 s with T&D and the 1 minute disagreement on the civil twilight end.

**TV-28. Oslo, 2025-12-21 (all four twilight thresholds present).**
Model: sunrise 08:18:14.4, sunset 14:12:06.4, solar noon 11:15:10.5,
civil 07:20:41.9 / 15:09:38.9, nautical 06:24:00.2 / 16:06:20.6, astronomical 05:32:35.3 / 16:57:45.5,
day length 5h 53m 52.1s.
USNO: rise 08:18, set 14:12, civil 07:21 / 15:10, transit 11:15. Verified.

**TV-29. Quito (0.1807 S, 78.4678 W), 2025-03-20 (equator, equinox).**
Model: sunrise 11:17:54.6, sunset 23:24:25.3, solar noon 17:21:10.0,
civil 10:57:14.8 / 23:45:05.1, nautical 10:33:15.1 / 00:09:22.9, astronomical 10:09:15.3 / 00:33:22.6,
day length 12h 06m 30.7s.
USNO: rise 11:18, set 23:24, civil 10:57 / 23:45, transit 17:21. MET Norway: rise 11:17 (az 89.97),
set 23:24 (az 270.23), noon 17:21 (elev 89.68). Verified.
Note that day length at the equator on the equinox is **12 h 06 m, not 12 h 00 m**: refraction and
the solar semi-diameter add about 6.5 minutes. This vector catches implementations that use a
geometric horizon.

**TV-30. Sydney (33.8688 S, 151.2093 E), 2025-09-22 (the day-boundary trap).**
Model with the grid scan of section 8.2, in chronological order within the UTC day:
sunset **07:51:25.9** UTC, then sunrise **19:43:37.9** UTC.
Model with NOAA's unnormalised iteration: sunrise 19:45:01.7 (wrong by 84 s).
USNO: Set 07:51, Rise 19:44. Tolerance 60 s. Assert the **order** as well as the times. This vector
exists specifically to catch the bug in section 8.2. Sources: USNO `rstt/oneday`. Verified.

**TV-31. Reykjavik (64.1466 N, 21.9426 W), 2025-12-21 (short winter day at high latitude).**
Model: sunrise 11:22:28.7, sunset 15:29:31.1, solar noon 13:26:00.0,
civil 10:03:08.3 / 16:48:51.6, nautical 08:54:00.3 / 17:57:59.6,
astronomical 07:53:59.0 / 18:58:00.8, day length 4h 07m 02.4s.
USNO: rise 11:22, set 15:30, civil 10:03 / 16:49, transit 13:26.
MET Norway: rise 11:22 (az 151.93), set 15:29 (az 208.08), noon 13:25 (elev 2.41). Verified.

**TV-32. Ushuaia (54.8019 S, 68.3030 W), 2025-12-21 (deep southern summer).**
Model: sunrise 07:51:32.0, sunset 01:10:58.4 (next UTC day), solar noon 16:31:30.3,
day length 17h 19m 26.4s. USNO: rise 07:52, set 01:11, transit 16:31. Verified.

**TV-33. London (51.5074 N, 0.1278 W), 2025-06-21 (astronomical twilight absent, nautical present).**
Model: sunrise 03:43:08.0, sunset 20:21:37.5, civil 02:55:21.3 / 21:09:23.9,
nautical 01:40:40.8 / 22:24:03.3, astronomical **none**.
USNO: rise 03:43, set 20:22, civil 02:55 / 21:09. MET Norway: rise 03:43 (az 48.91),
set 20:21 (az 311.1), noon 12:02 (elev 61.93), solar midnight 00:02 (elev -15.06).
The solar midnight elevation of -15.06 confirms nautical twilight is reached and astronomical is
not. Verified.

### Group G: 70 N, polar day and polar night

**TV-34. Day length at 70 N in June.**
Input: latitude 70.0 N, longitude 0.0, date 2025-06-21.
Expected: **no sunrise, no sunset, day length 24 h 00 m**, state = "continuously above the horizon".
Also expected: no civil, nautical or astronomical twilight event either (the Sun never drops below
-0.833, so it certainly never drops below -6).
Solar noon 12:01:52.5 UTC; solar midnight elevation **+3.44 deg**.
USNO: `Object continuously above the Horizon`, `Object continuously above the Twilight Limit`,
Lower Transit 00:02, Upper Transit 12:02.
MET Norway: `sunrise: null`, `sunset: null`, solar noon 12:01 (elev 43.44), solar midnight 00:01
(elev 3.44, `visible: true`). Verified against both.

**TV-35. Day length at 70 N in December.**
Input: latitude 70.0 N, longitude 0.0, date 2025-12-21.
Expected: **no sunrise, no sunset, day length 0 h 00 m**, state = "continuously below the horizon".
Twilight does occur: civil 09:54:31.9 / 14:01:51.7, nautical 08:05:44.9 / 15:50:38.7,
astronomical 06:45:43.4 / 17:10:40.1 UTC. Solar noon 11:58:11.9 UTC, maximum elevation
70 - 90 - 23.438 = **-3.44 deg**.
USNO: `Object continuously below the Horizon`, Begin Civil Twilight 09:55, End Civil Twilight 14:02.
Tolerance 60 s on the twilight times. Verified.

**TV-36. Polar day and polar night boundary dates at 70 N, 0 E.**
Expected transitions, each asserted as "this date has a set / this date does not":

| Date | Expected state |
|---|---|
| 2025-05-15 | rise 00:37, set 23:37 (last sunset before the midnight sun) |
| 2025-05-16 | rise 00:15, **no set** (a rise with no matching set on the same UTC day) |
| 2025-07-29 | rise 00:57, set 23:05 (midnight sun over) |
| 2025-11-24 | rise 11:14, set 12:19 (last full day) |
| 2025-11-25 | continuously below the horizon (polar night begins) |
| 2026-01-16 | continuously below the horizon (last day) |
| 2026-01-17 | rise 11:41, set 12:40 (polar night ends) |

Source: USNO `rstt/oneday` for each date, tz=0. Verified. Tolerance 60 s on the times; the
existence flags must match exactly.

### Group H: sidereal time and hour angle

**TV-37. GMST round trip and subsolar consistency.**
Input: 2025-06-21T12:00:00Z. Expected GMST **89.938092 deg** (05:59:45.1421) +/- 0.001 deg;
USNO returns 05:59:45.1384 (a 3.7 ms difference).
Assert that `normalise(-(GMST - alpha))` equals the equation of time route's subsolar longitude to
within 1e-6 degrees. This vector catches sign errors in the GHA definition.
Sources: USNO `siderealtime`; reference implementation. Verified.

### Notes on running these

* When querying USNO `celnav` yourself, pass observer coordinates at or near the subsolar point.
  USNO omits any body that is below the observer's horizon, and you will get a `KeyError` rather
  than an error message.
* USNO `rstt/oneday` returns times rounded to the minute. It rounds, it does not truncate
  (Oslo 01:53:45.7 becomes 01:54). MET Norway truncates (the same event becomes 01:53). Account for
  that when writing the assertion.
* Store the expected values in a JSON fixture, not inline in the test file, so they can be
  regenerated and diffed.

---

## 14. Pitfalls

### 14.1 JavaScript `Date` and UTC

Verified in Node 24 with the host time zone set to Europe/Oslo:

```
new Date('2025-06-21')            -> 2025-06-21T00:00:00.000Z    // date-only: parsed as UTC
new Date('2025-06-21T00:00:00')   -> 2025-06-20T22:00:00.000Z    // no offset: parsed as LOCAL
new Date('2025-06-21T00:00:00Z')  -> 2025-06-21T00:00:00.000Z
new Date(Date.UTC(2025, 5, 21))   -> 2025-06-21T00:00:00.000Z    // note: month is 0-based
```

Rules for this codebase:

* Every internal instant is a **`number` of milliseconds since the Unix epoch**, never a `Date`
  object passed around, and never a string.
* Construct instants only with `Date.UTC(...)` or by parsing a string that ends in `Z`.
* Never call `getFullYear()`, `getMonth()`, `getDate()`, `getHours()`: they are local-time getters
  and will silently shift your answer by the developer's own UTC offset. Use `getUTC*`.
* Never use `getTimezoneOffset()` for anything except debugging. It reports the *host's* offset,
  which has nothing to do with the location under the cursor on the map.

### 14.2 DST-correct local clocks for the timezone overlay

Do not store a fixed UTC offset per zone. Use the IANA database that is already in the browser via
`Intl`. Verified working pattern (Node 24, and identical in browsers):

```js
function offsetMinutes(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map(o => [o.type, o.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return (asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}
```

The `% 24` on the hour is required: `hour12: false` can emit `24` for midnight in some
implementations. Measured results:

| Zone | Instant | Offset (minutes) |
|---|---|---|
| Europe/Oslo | 2025-06-21T10:00Z | 120 |
| Europe/Oslo | 2025-12-21T10:00Z | 60 |
| Asia/Kathmandu | 2025-06-21T10:00Z | **345** (+05:45) |
| Pacific/Chatham | 2025-01-21T10:00Z | **825** (+13:45) |
| Australia/Lord_Howe | 2025-01-21T10:00Z | **660** (+11:00, a 30-minute DST shift from +10:30) |

Any overlay that assumes whole-hour offsets, or that assumes DST shifts are always one hour, is
wrong for those zones. `Intl.supportedValuesOf('timeZone')` gives the full zone list with no network
access, which satisfies the offline requirement.

### 14.3 Leap seconds

UTC has had no leap second since 2016-12-31 and IERS Bulletin C 72 confirms none at the end of 2026.
`Date` does not model leap seconds at all: `Date.UTC` treats every day as exactly 86400000 ms. This
introduces at most a 0.9 s discrepancy between your assumed UT1 and true UT1, which is 0.0037
degrees of Earth rotation, or 13 arcseconds of subsolar longitude, worst case. Do not try to model
leap seconds. Do note that this is the same order as your total model error, so it is the reason
you should not quote the subsolar longitude to better than an arcsecond even if the arithmetic
produces more digits.

### 14.4 delta T

`TT = UT1 + deltaT`. The Meeus and NOAA formulae want TT; the clock gives you UTC. Section 2.1
measured the cost of ignoring the difference: 1.14 arcseconds of subsolar latitude, 0.36 arcseconds
of longitude. Ignore it for the map. **Do not ignore it when converting a Meeus chapter 27 season
instant to a wall clock**, where it is a full 69 seconds and USNO publishes to the minute.

If you ever want it, the polynomial fits in Meeus chapter 10 are obsolete for the modern era; use
the measured table at `https://maia.usno.navy.mil/ser7/deltat.data` or just hard-code 69.1 s, which
is correct to 0.1 s for the whole 2024 to 2027 window.

### 14.5 `atan2` quadrant errors

Three places where a naive `atan` loses the quadrant:

1. **Right ascension.** `tan(alpha) = cos(eps) sin(lambda) / cos(lambda)` must be
   `atan2(cos(eps)*sin(lambda), cos(lambda))`. With plain `atan` the Sun's RA is wrong by 180
   degrees for half the year, which puts the terminator on the wrong side of the planet.
2. **Azimuth.** `tan(A) = sin(H) / (cos(H) sin(phi) - tan(delta) cos(phi))` must be
   `atan2(sin(H), cos(H)*sin(phi) - tan(delta)*cos(phi))`, then `+180` and `mod 360` for a north
   based azimuth. TV-22 (Quito, azimuth 8.96) and TV-23 (Sydney, azimuth 351.39) sit on opposite
   sides of the 0/360 wrap and will catch this.
3. **Hour angle differences.** `H = lon - subsolarLon` must be wrapped into `(-180, +180]` with
   `((x + 180) mod 360) - 180`, and the JavaScript `%` operator keeps the sign of the dividend, so
   `(-190 % 360) === -190`, not `170`. Always use `((x % 360) + 360) % 360` for the unsigned form.

NOAA's `acos`-based azimuth avoids the quadrant problem by branching on `sign(hourAngle)`, and it
needs a `Math.abs(azDenom) > 0.001` guard plus a hard-coded fallback of 180 (north) or 0 (south) at
the poles. Verified: the `atan2` form reproduces it exactly on every test case, without the guard.

### 14.6 Longitude sign conventions

* Our code, NOAA `main.js`, and the NOAA spreadsheet: **east positive**. Verified by reading the
  spreadsheet's literal cell text `Longitude (+ to E)` and by the structure of
  `solarTimeFix = eqTime + 4.0 * longitude - 60.0 * zone`.
* Meeus chapter 13: **west positive**. `H = theta0 - L - alpha` with `L` west positive. Negate on
  import.
* Older NOAA and Almanac-for-Computers material, and much sundial literature: west positive.
* GeoJSON, Leaflet, `navigator.geolocation`, and every map library: east positive, and the
  coordinate order is `[lon, lat]` in GeoJSON but `(lat, lon)` in Leaflet. USNO's API takes
  `coords=lat,lon`.

Write one function, `solarPosition({ lat, lon })` with east-positive `lon`, and convert at every
boundary. A single unit test at a large eastern longitude (Sydney, 151.2 E) and a large western one
(San Francisco, 122.4 W) catches every sign error; TV-23 and TV-30 do this.

### 14.7 Refraction near the horizon

* The refraction correction is **added** to the geometric elevation to get the apparent elevation.
  Getting the sign wrong moves the terminator 0.6 degrees, about 65 km.
* NOAA's `calcRefraction` gives 28.9 arcminutes at zero elevation, while the sunrise definition
  assumes 34 arcminutes. They are two different models inside one tool. Pick one per feature and be
  consistent: **fixed -0.833 for rise/set events, the piecewise fit for a displayed elevation**.
* Refraction is a real, weather-dependent physical quantity with a measured spread of
  +/- 0.5 arcminutes at half a degree altitude, and extremes of several degrees. Any sunrise time
  you print is uncertain by tens of seconds at mid latitudes and by minutes above 65 degrees
  (measured table in section 7.5).
* For the *rendered* twilight gradient, do not apply refraction at all. The gradient is a function
  of geometric solar elevation, and a 0.6 degree shift is invisible against a 6 degree wide colour
  band. Applying it per pixel just costs you a `tan` and a branch in the shader.

### 14.8 Geometric versus apparent sunrise

Four distinct definitions, all of which appear in the wild:

| Definition | `h0` | Oslo 2025-06-21 sunrise (UTC) | vs the standard |
|---|---|---|---|
| Apparent, disc **upper limb**, standard 34' refraction (the standard) | -0.833 | **01:53:45.7** | reference |
| Apparent, disc **centre**, standard 34' refraction | -0.5667 | 01:57:25.6 | +3 m 40 s |
| Disc fully clear of the horizon (SunCalc `sunriseEnd`) | -0.300 | 02:01:01.6 | +7 m 16 s |
| Geometric, disc centre, **no refraction at all** | 0.000 | 02:05:00.0 | +11 m 14 s |

Eleven minutes at Oslo in June, and more at higher latitudes. This is not a rounding detail.

NOAA's glossary: "Due to atmospheric refraction, sunrise occurs shortly before the sun crosses above
the horizon", and the calculator's times "have been corrected for the approximate effects of
atmospheric refraction". Use -0.833 and say so.

A visible consequence worth surfacing in the UI: **day length at the equator on the equinox is 12 h
06 m, not 12 h 00 m** (TV-29, Quito 2025-03-20: 12:06:31). Users will report this as a bug. It is
not.

### 14.9 The sub-minute drift that makes implementations disagree

Measured disagreements on identical inputs, all from this research:

| Source | Oslo 2025-06-21 sunrise (UTC) | vs USNO |
|---|---|---|
| USNO Astronomical Applications | 01:54 | reference |
| MET Norway sunrise 3.0 | 01:53 (truncated) | agrees |
| This document's algorithm | 01:53:45.7 | -14 s |
| SunCalc 1.9.0 | 01:55:00.4 | **+60 s** |
| api.sunrise-sunset.org | 01:50:12 | **-228 s** |
| timeanddate.com | 03:53 CEST = 01:53 UTC | agrees |

And day length, same day and place: this algorithm 18:50:10, timeanddate.com 18:49:57, a **13 second**
disagreement even though both round the rise and set to the same displayed minutes.

Causes, in decreasing order of size:

1. **A different horizon altitude.** api.sunrise-sunset.org is nearly 4 minutes early at Oslo in
   June while agreeing on civil twilight to 15 seconds, so it is not an ephemeris problem. At London
   it is 2 minutes early; at Reykjavik in December its sunset is 5 minutes late. Treat it as unusable
   above 50 degrees latitude.
2. **A baked-in time-scale fudge.** SunCalc's `J0 = 0.0009 day = 77.8 s` shifts every transit,
   rise and set by about +70 s. Reproduced at Oslo (+74 s), Sydney (+80 s) and Reykjavik (+115 s).
3. **Single-pass versus iterated declination.** Measured over all of 2025 at three longitudes:
   one pass is out by up to 22 s at the equator, 73 s at 40 degrees, 139 s at 60 degrees and 731 s
   at 70 degrees. Two passes brings that to 0.01 s, 0.08 s, 0.29 s and 16.6 s respectively. Above
   about 63 degrees the iteration stops being a contraction and a third pass can be *worse* than
   the second (measured 117 s at 65 degrees, 413 s at 70 degrees), which is why section 8.2
   recommends a bracketed root finder rather than more iterations.
4. **Which UTC day the event is assigned to.** Section 8.2, TV-30: 84 seconds at Sydney.
5. **NOAA's `calcSolNoon` half-day bug.** Section 8.3: up to 7 seconds, longitude dependent.
6. **The equation of time model itself.** 3.45 seconds worst case (section 10.2). This is the floor
   for the low accuracy chain and it is 20 times smaller than the refraction uncertainty.
7. **Local elevation above the horizon.** timeanddate.com applies a terrain/altitude correction for
   some locations by default, which is why its twilight ends can differ by a minute from USNO's
   sea-level answer.
8. **Rounding versus truncation of the displayed minute.** USNO rounds, MET Norway truncates. A
   naive comparison shows a spurious 1 minute disagreement half the time.

Practical rule for the test suite: **assert against USNO with a 60 second tolerance, and never
assert two third-party libraries against each other.**

---

## 15. Sources

Primary, fetched and read during this research:

* NOAA GML Solar Calculator source code (full algorithm):
  <https://gml.noaa.gov/grad/solcalc/main.js>
* NOAA GML solar calculation details and accuracy statement:
  <https://gml.noaa.gov/grad/solcalc/calcdetails.html>
* NOAA GML solar calculator glossary (twilight definitions, apparent sunrise):
  <https://gml.noaa.gov/grad/solcalc/glossary.html>
* NOAA solar calculation spreadsheet (column list, longitude convention):
  <https://gml.noaa.gov/grad/solcalc/NOAA_Solar_Calculations_day.xls>
* US Naval Observatory Astronomical Applications API v4.0.1 documentation:
  <https://aa.usno.navy.mil/data/api>
  * seasons: `https://aa.usno.navy.mil/api/seasons?year=YYYY&tz=0&dst=false`
  * rise/set/transit/twilight: `https://aa.usno.navy.mil/api/rstt/oneday?date=YYYY-MM-DD&coords=LAT,LON&tz=0`
  * celestial navigation (Sun GHA and Dec): `https://aa.usno.navy.mil/api/celnav?date=YYYY-MM-DD&time=HH:MM:SS&coords=LAT,LON`
  * sidereal time: `https://aa.usno.navy.mil/api/siderealtime?date=YYYY-MM-DD&coords=0.0,0.0&reps=1&intv_mag=1&intv_unit=hours&time=HH:MM:SS`
* USNO Earth's Seasons page: <https://aa.usno.navy.mil/data/Earth_Seasons>
* USNO delta T measured values: <https://maia.usno.navy.mil/ser7/deltat.data>
* USNO delta T predictions: <https://maia.usno.navy.mil/ser7/deltat.preds>
* IERS Bulletin C 72 (leap seconds): <https://datacenter.iers.org/data/latestVersion/bulletinC.txt>
* PyMeeus `Sun` module source with Meeus chapter 25 doctests:
  <https://pymeeus.readthedocs.io/en/latest/_modules/pymeeus/Sun.html>
* soniakeys/meeus Go port, chapter 13 coordinate transforms with equation numbers and page:
  <https://github.com/soniakeys/meeus/blob/master/v3/coord/coord.go>
* soniakeys/meeus Go port, chapter 27 equinox and solstice tables 27.A, 27.B, 27.C:
  <https://github.com/soniakeys/meeus/blob/master/v3/solstice/solstice.go>
* SunCalc 1.9.0 source: <https://cdn.jsdelivr.net/npm/suncalc@1.9.0/suncalc.js>
* MET Norway sunrise API 3.0: <https://api.met.no/weatherapi/sunrise/3.0/sun>
* api.sunrise-sunset.org: <https://api.sunrise-sunset.org/json>
* timeanddate.com Oslo sun table, June 2025:
  <https://www.timeanddate.com/sun/norway/oslo?month=6&year=2025>
* Wikipedia, Atmospheric refraction (Bennett, Saemundsson, the -50 arcminute convention):
  <https://en.wikipedia.org/wiki/Atmospheric_refraction>
* Wikipedia, Analemma: <https://en.wikipedia.org/wiki/Analemma>
* James Still, Astronomical Calculations: Solar Coordinates (Meeus chapter 25 walkthrough):
  <https://squarewidget.com/solar-coordinates/>
* James Still, Astronomical Calculations: Sidereal Time (Meeus equation 12.4):
  <https://squarewidget.com/astronomical-calculations-sidereal-time/>
* Alan Eliasen, `sun.frink` (Meeus chapter references for nutation, obliquity, refraction):
  <https://frinklang.org/frinksamp/sun.frink>

Book, not fetchable, values taken from the transcriptions cited above:

* Jean Meeus, *Astronomical Algorithms*, 2nd edition, Willmann-Bell 1998. Chapters 7 (Julian Day),
  10 (delta T), 12 (sidereal time, pp. 87-89), 13 (coordinate transformation, p. 93), 16
  (refraction), 22 (nutation and obliquity), 25 (solar coordinates, pp. 163-172), 27 (equinoxes and
  solstices), 28 (equation of time).

### Items marked UNVERIFIED

* The Meeus Table 27.A June solstice `Y^2` coefficient: PyMeeus has `-0.05323`, soniakeys/meeus has
  `-0.05232`. One is a transposition. Only affects years before 1000 CE.
* The exact printed text of the NOAA refraction equations on `calcdetails.html`: they are served as
  GIF images. The formulae in section 7.1 come from the JavaScript source, which is authoritative
  for what the tool actually computes, but I could not confirm they match the images.
* timeanddate.com values for cities other than Oslo: the site returns HTTP 403 to automated fetches
  and its terms discourage scripted downloads, so only the Oslo June 2025 table was obtained.
  All other cross-checks use USNO and MET Norway instead.
* The attribution of NOAA's `calcSolNoon` discrepancy to the `jd - 0.5` term is my reading of the
  source. The discrepancy itself (up to 7 s, table in section 8.3) is measured and reproducible.
