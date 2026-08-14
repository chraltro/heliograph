# Timezone data for the heliograph

Research note. Everything below marked VERIFIED was executed or fetched on 2026-08-14 on this
machine (Windows 11, Node v24.18.0, V8 with ICU 78.3, tzdata 2026b). Anything I could not run or
fetch is marked UNVERIFIED.

Working directory used for the experiments:
`C:\Users\cnd\AppData\Local\Temp\claude\C--gits-personal\66b52ca4-945c-48b6-9a0c-ae484a272bd4\scratchpad`

## 0. Executive summary

1. **Do not use Natural Earth `ne_10m_time_zones` for the clock layer.** It is a 2012 CIA World
   Factbook derivative, frozen since 2021, with 120 features, and its `tz_name1st` field is a
   hand written "example city zone" that is wrong or unusable for roughly half the polygons.
   It is fine as decorative meridian art, not as a source of truth.
2. **Use `timezone-boundary-builder` release `2026c`, asset
   `timezones-with-oceans-now.geojson.zip`.** That variant has exactly **64 polygons**, each
   carrying a real IANA `tzid`, and the set of 64 is precisely the set of distinct
   *current timekeeping behaviours* on Earth. It covers the whole globe including oceans, so
   there are no holes on a full screen map.
3. **A verified, end to end mapshaper pipeline produces 162,576 bytes of quantised TopoJSON**
   (40,032 bytes brotli, 45,173 bytes gzip) plus a 7,479 byte label point file. That is well
   under the 400 KB budget while keeping every coastline visibly irregular.
4. **`Intl` is enough for DST.** Cached `Intl.DateTimeFormat` instances format 63 zone clocks in
   0.038 ms per frame. For year long scrubbing, precompute the transition table instead:
   all 58 DST transitions of 2026 across all 63 zones were found in 275 ms.

---

## 1. Natural Earth `ne_10m_time_zones`

### 1.1 What was actually fetched

```
curl -sSL -o ne_10m_time_zones.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson
```

VERIFIED facts:

| Fact | Value |
| --- | --- |
| Byte size | **3,527,701 bytes** (3.36 MiB) |
| `type` | `FeatureCollection` |
| **Feature count** | **120** |
| Geometry types | 116 `Polygon`, 4 `MultiPolygon` |
| Total vertices | **155,007** across 143 rings (avg 1,292 per feature) |
| bbox | `[-180, -90, 180, 90.000206]` (note the latitude overshoot above 90) |
| Coordinate precision | up to 6 decimal places |
| Repo `VERSION` | `5.2.0-pre` |
| Last commit touching this file | **2021-12-08** ("final v5.0.0 geojson") |
| CRS block present | `urn:ogc:def:crs:OGC:1.3:CRS84` |
| Per feature `bbox` present | yes, each Feature carries its own `bbox` array |

Source: <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson>,
<https://api.github.com/repos/nvkelso/natural-earth-vector/commits?path=geojson/ne_10m_time_zones.geojson>

### 1.2 The real property schema

There are exactly **15** property keys, present on all 120 features. **There is no `note_home` and
no `note_non_home`** in the GeoJSON build. (Those field names appear in some other Natural Earth
themes and in older shapefile documentation, not here.) VERIFIED key list with counts of
non null values:

| Key | Type | Non null / 120 | Notes |
| --- | --- | --- | --- |
| `objectid` | int | 120 | **Not unique.** Only **37 distinct values** across 120 features, so it cannot be used as a feature key. |
| `scalerank` | int | 120 | Always `6`. Useless. |
| `featurecla` | string | 120 | Always `"Timezone"`. Useless. |
| `name` | string | 120 | Signed decimal hours as a string: `"-10"`, `"+5.75"`, `"+12.75"`, `"0"`. |
| `map_color6` | int | 120 | 1..6, a 6 colour graph colouring so adjacent zones differ. Genuinely useful. |
| `map_color8` | int | 120 | 1..8, same idea with 8 colours. |
| `note` | string / null | **13** | Free text, all of it stale 2012 commentary (see below). |
| `zone` | number | 120 | **Standard time offset in decimal hours. No DST applied.** |
| `utc_format` | string | 120 | `"UTC-10:00"`, `"UTC+05:45"`, and for zero: `"UTC±00:00"` (a literal U+00B1). |
| `time_zone` | string | 120 | Byte for byte identical to `utc_format` in every feature. Redundant. |
| `iso_8601` | string | 120 | A **frozen 2012 timestamp**, e.g. `"2012-05-30T18:33:50-10:00"`. Only the trailing offset carries information. |
| `places` | string | 120 | Human readable list of countries or `"Arctic Ocean"` / `"Antarctica"`. |
| `dst_places` | string / null | **27** | Human readable list of the places inside the polygon that observe DST. |
| `tz_name1st` | string / null | **87** | One example IANA-ish name. See section 1.4, it is a trap. |
| `tz_namesum` | int | 120 | Claimed count of IANA names inside the polygon. Distinct values: 0,1,2,3,4,5,6,8,9,10,11,14,16,19,21,23,25,26,39,48. Frequently inconsistent with `tz_name1st`. |

### 1.3 Genuine example features (verbatim property blocks)

Ocean feature, no IANA name at all:

```json
{"objectid":2,"scalerank":6,"featurecla":"Timezone","name":"-10","map_color6":4,
 "map_color8":4,"note":null,"zone":-10,"utc_format":"UTC-10:00","time_zone":"UTC-10:00",
 "iso_8601":"2012-05-30T18:33:50-10:00","places":"Arctic Ocean","dst_places":null,
 "tz_name1st":null,"tz_namesum":0}
```

Continental North America:

```json
{"objectid":9,"scalerank":6,"featurecla":"Timezone","name":"-5","map_color6":5,
 "map_color8":3,"note":null,"zone":-5,"utc_format":"UTC-05:00","time_zone":"UTC-05:00",
 "iso_8601":"2012-05-30T23:33:50-05:00",
 "places":"Colombia, Cuba, Ecuador (continental), Jamaica, Panama, Peru",
 "dst_places":"Canada (most of Ontario, most of Quebec), Haiti, United States (most of Florida, Georgia, Massachusetts, most of Michigan, New York, North Carolina, Ohio, Washington D.C.)",
 "tz_name1st":"America/New_York","tz_namesum":26}
```

Note how broken that one is: `places` lists the non DST countries and `dst_places` lists the DST
ones, but they are the *same polygon*. A single UTC-5 polygon contains both Panama (no DST) and
New York (DST). You cannot colour or clock that polygon with one rule.

Half hour and three quarter hour zones:

```json
{"objectid":32,"scalerank":6,"featurecla":"Timezone","name":"+10.5","map_color6":3,
 "map_color8":8,"note":null,"zone":10.5,"utc_format":"UTC+10:30","time_zone":"UTC+10:30",
 "iso_8601":"2012-05-31T15:03:50+10:30","places":"Lord Howe Island",
 "dst_places":"Lord Howe Island","tz_name1st":"Australia/Lord_Howe","tz_namesum":1}

{"objectid":36,"scalerank":6,"featurecla":"Timezone","name":"+12.75","map_color6":2,
 "map_color8":1,"note":null,"zone":12.75,"utc_format":"UTC+12:45","time_zone":"UTC+12:45",
 "iso_8601":"2012-05-31T17:18:50+12:45","places":"Chatham Islands",
 "dst_places":"Chatham Islands","tz_name1st":"Pacific/Chatham","tz_namesum":1}

{"objectid":23,"scalerank":6,"featurecla":"Timezone","name":"+5.5","map_color6":3,
 "map_color8":3,"note":null,"zone":5.5,"utc_format":"UTC+05:30","time_zone":"UTC+05:30",
 "iso_8601":"2012-05-31T10:03:50+05:30","places":"India, Sri Lanka","dst_places":null,
 "tz_name1st":"Asia/Kolkata","tz_namesum":1}
```

All 13 non null `note` values (VERIFIED, complete list):

* `"Reflects 2012 International Date Line switch for Western Samoa and Kiribati"` (2 features, zone 13 and 14)
* `"Reflects 2012 shift in daylight savings time in Russia."` (10 features)
* `"DST is -3"` (1 feature, zone 0, Halley Station)

### 1.4 Definitive answers to the questions asked

**Are these legal timezone boundaries or nominal nautical ones? Both, mixed in one layer.**

* On land, they are real, irregular, legal-ish boundaries traced to Natural Earth's 1:10m line
  work. VERIFIED: the `America/New_York` feature ring has 5,574 vertices with **4,200 distinct
  longitudes**, and the boundary weaves along coastlines and state lines.
* At sea, they are **nominal nautical zones**: straight meridians at multiples of 15 degrees
  offset by 7.5 degrees. VERIFIED: the `places: "Arctic Ocean"`, `zone: 7` polygon has a ring of
  98 vertices whose longitude is `112.5` repeated (drifting only in the sixth decimal from a
  projection round trip: `112.500353`, `112.500706`, ...). `112.5 = 7.5 x 15`. The zone -10 Arctic
  polygon runs down the `-157.52562` and `-142.5` meridians, exactly the nautical UTC-10 band
  (142.5 W to 157.5 W).
* **30 of the 120 features** have `places` equal to an ocean or `"Antarctica"`.

Natural Earth's own page says the data "primarily derive from the Central Intelligence Agency map
of Time Zones, downloaded from the World Factbook website May 2012", adjusted to "twelve nautical
mile territorial sea boundaries".
Source: <https://www.naturalearthdata.com/downloads/10m-cultural-vectors/timezones/>

**Is `zone` a standard-time offset without DST? Yes.** VERIFIED. `zone` is a plain decimal hour
number. Distinct values, all 40 of them:

```
-12, -11, -10, -9.5, -9, -8, -7, -6, -5, -4.5, -4, -3.5, -3, -2, -1, 0,
1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 8.75, 9, 9.5, 10,
10.5, 11, 11.5, 12, 12.75, 13, 14
```

Note this is a snapshot of *2012* standard offsets. Several are now wrong: `Europe/Moscow` is
tagged `zone: 4` (Russia's 2011-2014 permanent DST experiment) when Moscow is UTC+3 today, and
`Europe/Minsk` and `Europe/Kaliningrad` are both tagged `zone: 3` even though Kaliningrad is UTC+2.

**Does `tz_name1st` contain real IANA identifiers, and for how many features?**

VERIFIED counts:

| Measure | Count |
| --- | --- |
| Features with a non null `tz_name1st` | 87 of 120 |
| Distinct `tz_name1st` strings | 68 |
| Distinct strings that `Intl.DateTimeFormat` accepts | **65** |
| Distinct strings that throw `RangeError` | 3: `"Antarctica/"`, `"Antarctica/Central"`, `"Antarctica/Mirny"` |
| **Features whose `tz_name1st` is an Intl-usable id** | **68 of 120 (57%)** |

The 19 broken features are almost all Antarctic: `"Antarctica/"` with a trailing slash and nothing
after it appears on 19 features, `"Antarctica/Central"` is not a tzdb zone at all, and
`"Antarctica/Mirny"` is rejected by this ICU build.

Worse, being *parseable* is not the same as being *correct*. Real examples straight out of the
file:

| `zone` | `tz_name1st` | `places` | Verdict |
| --- | --- | --- | --- |
| 8 | `Australia/Perth` | "China, Hong Kong, Russia (Krasnoyarsk Krai), Malaysia, Philippines, Singapore, Taiwan, most of Mongolia, Western Australia" | Nonsense as a label for China |
| 2 | `Africa/Johannesburg` | "Libya, Egypt, Malawi, Mozambique, South Africa, ..." | Egypt has DST, Johannesburg does not |
| 2 | `Europe/Mariehamn` | "Libya, Egypt, Bulgaria, Cyprus, Greece, Israel, ..." | Mariehamn is UTC+2 Finland, but this polygon is the EET band |
| 1 | `Europe/Paris` | "Angola, Cameroon, Nigeria, Tunisia" | Paris has DST, Lagos does not |
| 7 | `Asia/Jakarta` | "Jakarta, Thailand, Vietnam" | OK, but `tz_namesum: 9` |
| 12 | `Pacific/Auckland` | "New Zealand, Kiribati (Gilbert Islands), Fiji" | Three different DST rules |
| 0 | `Europe/Lisbon` | "Côte d'Ivoire, Ghana, Senegal, Morocco, ..." | Lisbon has DST, Abidjan does not |
| -4 | `America/La_Paz` | "Bolivia, Brazil (Amazonas), Chile (continental), Dominican Republic, Canada (Nova Scotia), Puerto Rico, Trinidad and Tobago" | Halifax and La Paz disagree half the year |

Three more of the 65 are **deprecated tzdb links** that this ICU build silently rewrites:

```
Asia/Kathmandu        -> Asia/Katmandu
Asia/Kolkata          -> Asia/Calcutta
Antarctica/South_Pole -> Antarctica/McMurdo
```

**Bottom line: `ne_10m_time_zones` is not usable as a DST source.** Its only genuinely useful
properties for a heliograph are `map_color6` / `map_color8` (a ready made adjacency colouring) and
the nautical meridian geometry if you want a decorative "nautical time" overlay.

---

## 2. Mapping polygons to IANA zone ids

### 2.1 The recommended strategy: do not map, pick a dataset that is already mapped

The cleanest answer is to skip the mapping problem entirely by using
`timezone-boundary-builder`'s `with-oceans-now` product, where every polygon already has a
correct `tzid` property and the polygon set is *defined* by identical clock behaviour. See
section 3.1. This is what the rest of this document recommends.

### 2.2 If you insist on using Natural Earth geometry

Then you need a three tier resolution:

**Tier 1: an explicit override table.** Hand write a map from `(objectid, places)` to a
representative IANA zone. There are only 120 features, so this is a one afternoon job and it is
auditable. Key it on something stable; `objectid` alone is not unique (37 distinct values for 120
features), so use `objectid + "|" + places`.

```ts
// src/data/ne-tz-overrides.ts
export const NE_TZ_OVERRIDE: Record<string, string> = {
  '9|Colombia, Cuba, Ecuador (continental), Jamaica, Panama, Peru': 'America/Bogota',
  '23|India, Sri Lanka': 'Asia/Kolkata',
  '32|Lord Howe Island': 'Australia/Lord_Howe',
  '36|Chatham Islands': 'Pacific/Chatham',
  // ... 116 more
};
```

**Tier 2: geometric lookup.** For anything not overridden, compute an inner point of the polygon
(`mapshaper -points inner`, see section 4.5) and run it through a point to zone lookup at build
time, then bake the answer into the JSON. Use `geo-tz` for this since it runs in Node and is the
accurate one (section 3.4). This is build time, so its 70 MB install is irrelevant.

```js
// build step, Node only
import { find } from 'geo-tz';          // 'same since 1970' product
const [lon, lat] = innerPoint(feature);
const tzid = find(lat, lon)[0] ?? null;  // note: (lat, lon) order
```

**Tier 3: the fallback for polygons with no usable IANA name.** Two cases:

* *Ocean / nautical bands.* These have a well defined UTC offset and never observe DST. Synthesise
  an `Etc/GMT±N` id from the `zone` field. **Watch the sign inversion**: POSIX `Etc/GMT+N` means
  UTC minus N. VERIFIED in Node: `Etc/GMT+12` formats as `GMT-12:00`, `Etc/GMT-14` formats as
  `GMT+14:00`.

  ```ts
  /** zone = decimal hours east of Greenwich, e.g. -10, +5.5 */
  function etcIdForOffset(zoneHours: number): string | null {
    if (!Number.isInteger(zoneHours)) return null;   // Etc/* only exists at whole hours
    if (zoneHours < -14 || zoneHours > 12) return null;
    if (zoneHours === 0) return 'UTC';
    // sign is INVERTED relative to the human offset
    return `Etc/GMT${zoneHours > 0 ? '-' : '+'}${Math.abs(zoneHours)}`;
  }
  ```

  Caveat, VERIFIED: **`Intl.supportedValuesOf('timeZone')` in Node 24 / ICU 78.3 returns zero
  `Etc/*` entries and does not contain `"UTC"`**, yet `Intl.DateTimeFormat` happily accepts
  `Etc/GMT+12`, `Etc/GMT-14`, `Etc/UTC` and `UTC`. So never validate a zone id by membership in
  `supportedValuesOf`; validate it by try/catch around a `DateTimeFormat` construction.

* *Non integer ocean offsets and the `"Antarctica/"` junk.* There is no `Etc/*` for +5:45 and there
  is no meaningful clock at the pole. Do not fabricate a zone. Represent these as a
  fixed offset object in your own model:

  ```ts
  type ZoneRef =
    | { kind: 'iana'; id: string }
    | { kind: 'fixed'; offsetMinutes: number; label: string };   // e.g. UTC+05:45 nautical
  ```

  and render Antarctic polygons with a neutral fill and no clock label. Antarctica genuinely has
  no single time; research stations pick their supply chain's zone. The honest map shows
  Antarctica as one hatched region, optionally with a handful of pinned station clocks
  (`Antarctica/Troll`, `Antarctica/Casey`, `Antarctica/Rothera`, `Antarctica/McMurdo`,
  `Antarctica/Palmer`, `Antarctica/Davis`, `Antarctica/Mawson`, `Antarctica/Syowa`,
  `Antarctica/Vostok`, `Antarctica/Macquarie`, all VERIFIED present in `supportedValuesOf`).

**Tier 4: normalise aliases yourself.** VERIFIED in Node 24 / ICU 78.3:

```js
new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata' }).resolvedOptions().timeZone
// => 'Asia/Calcutta'
new Intl.DateTimeFormat('en', { timeZone: 'Europe/Kyiv' }).resolvedOptions().timeZone
// => 'Europe/Kiev'
new Intl.DateTimeFormat('en', { timeZone: 'Pacific/Kanton' }).resolvedOptions().timeZone
// => 'Pacific/Enderbury'
```

MDN says the *specified* behaviour is the opposite: "the standardization of `Temporal` requires
browsers to always return the primary identifier in the IANA database ... the returned array
should contain `Asia/Kolkata` instead of `Asia/Calcutta`".
Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf>

So the engine and the spec disagree today, and they will disagree differently across browsers and
across time. **Never use `resolvedOptions().timeZone` as a canonical key.** Keep your own tiny
alias table for the handful of renames you actually display, and key everything internally on the
id you shipped in your own JSON. UNVERIFIED: exact behaviour in Firefox and Safari; I could not
run a browser here. Treat cross engine canonicalisation as unreliable by default.

---

## 3. Alternatives, with real numbers

### 3.1 evansiroky/timezone-boundary-builder

VERIFIED via `https://api.github.com/repos/evansiroky/timezone-boundary-builder/releases`.

**Current release tag: `2026c`, published 2026-07-11T06:36:04Z.** Release notes verbatim:

> ### Zone Changes
> * Update to latest OSM data.
> * Recalculate timezones since 1970 and timezones since now with most recent timezone database data.
> ### Other Changes
> * Fix a bug that caused similar timezones to not merge despite same UTC Offsets after transitions. ([#210](https://github.com/evansiroky/timezone-boundary-builder/pull/210))

**Complete asset list for 2026c with exact sizes:**

| Asset | MB | bytes |
| --- | ---: | ---: |
| `input-data.zip` | 68.39 | 71,708,826 |
| `timezone-names-1970.json` | 0.013 | 13,962 |
| `timezone-names-Now.json` | 0.009 | 8,959 |
| `timezone-names-with-oceans-1970.json` | 0.014 | 14,229 |
| `timezone-names-with-oceans-Now.json` | 0.009 | 9,250 |
| `timezone-names-with-oceans.json` | 0.008 | 8,038 |
| `timezone-names.json` | 0.007 | 7,734 |
| `timezones-1970.geojson.zip` | 42.88 | 44,962,094 |
| `timezones-1970.shapefile.zip` | 68.14 | 71,446,600 |
| **`timezones-now.geojson.zip`** | **23.34** | 24,470,694 |
| `timezones-now.shapefile.zip` | 36.49 | 38,264,928 |
| `timezones-with-oceans-1970.geojson.zip` | 45.91 | 48,141,545 |
| `timezones-with-oceans-1970.shapefile.zip` | 72.65 | 76,176,877 |
| **`timezones-with-oceans-now.geojson.zip`** | **25.02** | 26,238,140 |
| `timezones-with-oceans-now.shapefile.zip` | 38.98 | 40,875,447 |
| `timezones-with-oceans.geojson.zip` | 52.88 | 55,449,715 |
| `timezones-with-oceans.shapefile.zip` | 83.96 | 88,036,674 |
| `timezones.geojson.zip` | 48.91 | 51,283,605 |
| `timezones.shapefile.zip` | 78.04 | 81,834,185 |

**Important correction to a common assumption: `timezone-boundary-builder` does NOT publish a
"simplified" asset.** There is no `...-simplified...` file in any release. The four data axes are
`{comprehensive | -1970 | -now} x {land only | with-oceans} x {geojson | shapefile}`. Simplification
is entirely on you (section 4).

For the record, the two immediately previous releases (VERIFIED sizes for the two assets that
matter here):

| Tag | Published | `timezones-now.geojson.zip` | `timezones-with-oceans-now.geojson.zip` |
| --- | --- | ---: | ---: |
| `2026c` | 2026-07-11 | 24,470,694 B | 26,238,140 B |
| `2026b` | 2026-04-29 | 24,344,907 B | 26,118,663 B |
| `2026a` | 2026-03-08 | 24,206,365 B | 25,989,884 B |

`2026a`'s notes mention "an expected zone overlap between `America/Los_Angeles` and
`America/Vancouver` for a disputed area of seaward boundary of the Strait of Juan de Fuca", which
is a reminder that TBB polygons are not guaranteed non overlapping. Pin a release tag in your build
script rather than tracking `latest`, so a shape change never lands silently.

**What is inside each variant (VERIFIED by unzipping):**

| Variant | zip name | inner file | features | unzipped bytes | total vertices |
| --- | --- | --- | ---: | ---: | ---: |
| Comprehensive | `timezones.geojson.zip` | `combined.json` | 419 (from `timezone-names.json`) | not unzipped | UNVERIFIED |
| Same since 1970 | `timezones-1970.geojson.zip` | `combined-1970.json` | 301 groups | not unzipped | UNVERIFIED |
| **Same since now** | `timezones-now.geojson.zip` | `combined-now.json` | **63** | **79,296,875** | **3,552,919** |
| Comprehensive + oceans | `timezones-with-oceans.geojson.zip` | | 444 | | UNVERIFIED |
| **Same since now + oceans** | `timezones-with-oceans-now.geojson.zip` | `combined-with-oceans-now.json` | **64** | **84,497,709** | **3,789,891** |

Feature properties are minimal: `{"tzid": "Africa/Abidjan"}`. Geometry types in `combined-now.json`:
46 `MultiPolygon`, 17 `Polygon`.

**The 63 "now" zone ids, complete and VERIFIED:**

```
Africa/Abidjan, Africa/Cairo, Africa/Casablanca, Africa/Johannesburg, Africa/Lagos,
America/Adak, America/Anchorage, America/Caracas, America/Chicago, America/Denver,
America/Halifax, America/Havana, America/Lima, America/Los_Angeles, America/Mexico_City,
America/Miquelon, America/New_York, America/Noronha, America/Nuuk, America/Phoenix,
America/Santiago, America/Sao_Paulo, America/St_Johns, Antarctica/Troll, Asia/Beirut,
Asia/Dhaka, Asia/Dubai, Asia/Gaza, Asia/Jakarta, Asia/Jerusalem, Asia/Kabul, Asia/Karachi,
Asia/Kathmandu, Asia/Kolkata, Asia/Manila, Asia/Sakhalin, Asia/Tehran, Asia/Tokyo,
Asia/Yangon, Atlantic/Azores, Atlantic/Cape_Verde, Australia/Adelaide, Australia/Brisbane,
Australia/Darwin, Australia/Eucla, Australia/Lord_Howe, Australia/Sydney, Europe/Athens,
Europe/London, Europe/Moscow, Europe/Paris, Pacific/Auckland, Pacific/Chatham,
Pacific/Easter, Pacific/Fiji, Pacific/Gambier, Pacific/Honolulu, Pacific/Kiritimati,
Pacific/Marquesas, Pacific/Norfolk, Pacific/Pago_Pago, Pacific/Pitcairn, Pacific/Tongatapu
```

The with-oceans version adds exactly one more: `Etc/GMT+12` (the UTC-12 nautical band, which no
land zone matches).

**`timezone-names-Now.json` is the alias manifest you need for search and labelling.** VERIFIED:
it is an object of 63 keys, whose values are arrays totalling 419 ids. Examples:

```json
"Europe/London": ["Europe/London","Europe/Lisbon","Europe/Dublin","Atlantic/Canary",
                  "Atlantic/Madeira","Atlantic/Faroe","Europe/Guernsey","Europe/Isle_of_Man",
                  "Europe/Jersey"]
"Pacific/Auckland": ["Pacific/Auckland","Antarctica/McMurdo"]
"Australia/Lord_Howe": ["Australia/Lord_Howe"]
"Asia/Kolkata": ["Asia/Kolkata","Asia/Colombo"]
```

The five largest groups: `Europe/Paris` (33 ids), `America/Caracas` (31), `America/Sao_Paulo` (29),
`Europe/Moscow` (25), `Africa/Abidjan` (17) and `Asia/Karachi` (17).

`timezone-names-with-oceans-Now.json` is the same 63 keys but 443 ids, with the `Etc/GMT±N`
nautical ids folded into whichever land group has the matching behaviour. VERIFIED mapping of the
ocean bands:

```
Africa/Abidjan      <- Etc/UTC, Etc/GMT      Africa/Lagos        <- Etc/GMT-1
America/Noronha     <- Etc/GMT+2             America/Sao_Paulo   <- Etc/GMT+3
America/Caracas     <- Etc/GMT+4             America/Lima        <- Etc/GMT+5
America/Mexico_City <- Etc/GMT+6             America/Phoenix     <- Etc/GMT+7
Pacific/Pitcairn    <- Etc/GMT+8             Pacific/Gambier     <- Etc/GMT+9
Pacific/Honolulu    <- Etc/GMT+10            Pacific/Pago_Pago   <- Etc/GMT+11
Atlantic/Cape_Verde <- Etc/GMT+1             Africa/Johannesburg <- Etc/GMT-2
Europe/Moscow       <- Etc/GMT-3             Asia/Dubai          <- Etc/GMT-4
Asia/Karachi        <- Etc/GMT-5             Asia/Dhaka          <- Etc/GMT-6
Asia/Jakarta        <- Etc/GMT-7             Asia/Manila         <- Etc/GMT-8
Asia/Tokyo          <- Etc/GMT-9             Australia/Brisbane  <- Etc/GMT-10
Asia/Sakhalin       <- Etc/GMT-11            Pacific/Fiji        <- Etc/GMT-12
(Etc/GMT+12 stands alone as its own polygon)
```

**The one gotcha with the "now" product for a labelled map**: the representative id is the highest
population member of the group, so Oslo is inside the `Europe/Paris` polygon and Berlin, Stockholm
and Copenhagen are too. VERIFIED: `names-now.json`'s `Europe/Paris` group has 33 members including
`Europe/Oslo`. If you show the raw `tzid` as the label, a Norwegian reader will see "Europe/Paris"
over Norway and think the app is broken. Two fixes:

1. Label with `Intl.DateTimeFormat(locale, {timeZone: tzid, timeZoneName: 'longGeneric'})` instead
   of the raw id. VERIFIED: that yields "Central European Time" for `Europe/Paris`, "Nepal Time"
   for `Asia/Kathmandu`, "Chatham Time" for `Pacific/Chatham`, "Lord Howe Time" for
   `Australia/Lord_Howe`. Much better.
2. On hover/click, resolve the *pointer's* zone precisely using `@photostructure/tz-lookup`
   (73 KB, section 3.4) and show the specific id, while the polygon clock stays group level.

Licence, verbatim from the TBB README: "The code used to construct the timezone boundaries is
licensed under the MIT License. The outputted data is licensed under the Open Data Commons Open
Database License (ODbL)." ODbL is share alike, so if you ship a derived (simplified) file you must
attribute and keep the derived database under ODbL. Say so in an About panel.
Source: <https://github.com/evansiroky/timezone-boundary-builder/blob/master/README.md>

Also verbatim from that README: the project "does include ocean data but strictly uses territorial
waters and not Exclusive Economic Zones", and "the data is almost completely comprised of
OpenStreetMap data which is editable by anyone" with "a few guesses on where to draw an arbitrary
border in the open waters and a few sparsely inhabited areas".

### 3.2 Community GeoJSON repos

There is **no GitHub repository literally named `timezones.geojson`** (GitHub repo search for
`timezones.geojson in:name` returns 1 unrelated result, `shigobu/TimezonesGeojsonThinOut`, 1 star).
The name almost certainly refers to the `timezones.geojson.zip` **release asset** of TBB covered
above. The genuine community mirrors and derivatives, with VERIFIED sizes from the GitHub contents
API:

| Repo | File | Size | Notes |
| --- | --- | ---: | --- |
| [`dejurin/simplified-timezone-boundaries`](https://github.com/dejurin/simplified-timezone-boundaries) | `output.geojson` | **0.32 MB** | Already under 400 KB. Built by piping the TBB shapefile through mapshaper. See its script in section 4.3. |
| [`treyerl/timezones`](https://github.com/treyerl/timezones) | `timezones_wVVG8.geojson` | 0.96 MB | Simplified, includes sea. Also ships `all_tz.shp` 6.42 MB and `tz_world.shp` 27.81 MB. Old `tz_world` lineage. |
| [`candu/efele-tz-world-geojson`](https://github.com/candu/efele-tz-world-geojson) | `tz_world.geojson` | 92.69 MB | GeoJSON of the long dead efele.net `tz_world` shapefile. Do not use, it predates TBB and is unmaintained. |
| [gist `tschaub/cc70281ce4df5358eac38b34409b9ef9`](https://gist.github.com/tschaub/cc70281ce4df5358eac38b34409b9ef9) | TopoJSON time zones | UNVERIFIED size | A gist, not a maintained dataset. |

`dejurin/simplified-timezone-boundaries` is the closest off the shelf answer to "a ready to use
sub 400 KB timezone GeoJSON". Its README warns: "The reduction in percentage of removable points
is proportional to the reduction in area, so small island states or the Vatican, Monaco could be
ignored." It is also pinned to `mapshaper ^0.6.41` and its `output.geojson` is a snapshot of
whatever the latest TBB release was when it last ran, which is not stated. Building yourself
(section 4.6) is only marginally more work and gives you control and a known TBB tag.

### 3.3 Precomputed point lookups: `tz-lookup` and `@photostructure/tz-lookup`

VERIFIED via `registry.npmjs.org` and by installing both.

| | `tz-lookup` | `@photostructure/tz-lookup` |
| --- | --- | --- |
| Latest version | **6.1.25** | **11.6.1** |
| npm `unpackedSize` | **151,899 B (0.14 MB)** | **87,999 B (0.08 MB)** |
| Actual `node_modules` on disk | **167 KB** | **97 KB** |
| The payload file | `tz.js`, **73,439 B** | `tz.js`, **73,349 B** |
| Runtime dependencies | **none** | **none** |
| Module format | plain script defining `function tzlookup(...)`, ending with `"undefined"!=typeof module&&(module.exports=tzlookup)` | same shape, plus `index.d.ts` |
| **Runs in a browser** | **Yes.** README shows `<script src="tz.js"></script>` then `tzlookup(42.7235, -73.6931)`. Ships a `test.html`. | **Yes**, same single file, same UMD-ish tail |
| Data vintage | TBB, "database was last updated on 6 Jan 2019" (README) | current TBB, actively rebuilt |
| TypeScript types | no | yes (`index.d.ts`) |
| Maintenance | fork source abandoned 2020 | maintained by PhotoStructure |

VERIFIED live calls in Node:

```
tz-lookup            (59.91, 10.75)  -> Europe/Oslo
tz-lookup            (27.71, 85.32)  -> Asia/Kathmandu
tz-lookup            (-43.95,-176.55)-> Pacific/Chatham
tz-lookup            (0, -150)       -> Pacific/Kiritimati
@photostructure      (-31.55, 159.08)-> Australia/Lord_Howe
```

Argument order is `(latitude, longitude)`, not `(lon, lat)`.

Accuracy warning, quoted verbatim from the `@photostructure/tz-lookup` README:

> If you take a random point on the earth, roughly 30% of the results from this package won't match
> the (accurate) result from `geo-tz`. This drops to roughly 10% if you only pick points that are
> likely inhabited. This error rate drops to roughly 5% if you consider time zones (like
> `Europe/Vienna` and `Europe/Berlin`) that result in equivalent time zone offset values throughout
> the year.

and on speed, from the same README (measured January 2024, AMD 5950X, Node 20):

> this package takes ~.05 milliseconds per lookup, and geo-tz takes ~5 milliseconds per lookup

That 5% residual error rate on *observed offset* is acceptable for a hover readout on a world map
and completely unacceptable as the sole source for the polygon layer. Use it for
"what zone is under the cursor", not for drawing.

Prefer **`@photostructure/tz-lookup`**: half the install size, current data, TypeScript types,
maintained.

### 3.4 `geo-tz`

VERIFIED via `registry.npmjs.org/geo-tz/latest`:

| Field | Value |
| --- | --- |
| Version | **8.1.8** |
| npm `unpackedSize` | **73,446,857 B = 70.04 MB** |
| Dependencies | `pbf ^3.2.1`, `geobuf ^3.0.2`, `@turf/helpers ^7.1.0`, `@turf/boolean-point-in-polygon ^7.1.0` |
| Entry points | `.` -> `dist/find-1970.js`, `./all` -> `find-all.js`, `./now` -> `find-now.js` |
| **Browser** | **No.** VERIFIED: `src/find.ts` opens with `import * as fs from 'fs'` and lazily reads geobuf tiles off disk. |

The README itself says it "may encounter difficulties when bundling" and, in the fork's words,
"if accuracy is important for your application and you don't need to support browsers, use
geo-tz". Correct role for this project: **a build time dependency only**, used to stamp accurate
`tzid` values onto polygons or label points. Never shipped to the client.
Source: <https://github.com/evansiroky/node-geo-tz>

### 3.5 Recommendation matrix

| Need | Use |
| --- | --- |
| Drawing the zone polygons offline, < 400 KB | TBB `2026c` `timezones-with-oceans-now`, simplified to TopoJSON (section 4.6) |
| Which zone is under the mouse, in browser | The shipped TopoJSON itself (point in polygon over 64 polys is trivial), or `@photostructure/tz-lookup` if you want street level precision |
| Stamping accurate ids at build time | `geo-tz` 8.1.8 in Node |
| The clock in each zone | `Intl.DateTimeFormat` (section 5) |
| A nautical / decorative meridian layer | Natural Earth `ne_10m_time_zones` ocean features only |

---

## 4. Simplification to under 400 KB

All numbers in this section are VERIFIED by running the commands on this machine.

Toolchain installed: `mapshaper@0.7.52` (14.32 MB unpacked, per npm registry; 15 MB on disk),
`topojson-server@3.0.1` (71,124 B), `topojson-simplify@3.0.3` (50,556 B),
`topojson-client@3.1.0` (67,594 B).

### 4.1 `mapshaper -simplify` options that actually exist

Verbatim from `mapshaper -h simplify` on 0.7.52:

```
OPTIONS
  <percentage>  shortcut for percentage=
  percentage=   percentage of removable points to retain, e.g. 10%
  dp, rdp       use Ramer-Douglas-Peucker simplification
  visvalingam   use Visvalingam simplification with "effective area" metric
  weighted      use weighted Visvalingam simplification (default)
  weighting=    weighted Visvalingam coefficient (default is 0.7)
  resolution=   output resolution as a grid (e.g. 1000x500)
  interval=     output resolution as a distance (e.g. 100m)
  variable      JS expr. assigning to one of: interval= percentage= resolution=
  planar        simplify decimal degree coords in 2D space (default is 3D)
  keep-shapes   prevent small polygon features from disappearing
  no-repair     don't remove intersections introduced by simplification
  stats         display simplification statistics
  target=       layer(s) to target (comma-sep. list)
```

Two things worth internalising:

* **The default method is `weighted` Visvalingam with `weighting=0.7`, not plain `visvalingam`.**
  Weighted Visvalingam penalises removing points at sharp angles, which is exactly what keeps a
  coastline looking like a coastline instead of a polygon. Use the default.
* **`keep-shapes` is mandatory here.** Without it Lord Howe Island (226 vertices in the source),
  Norfolk Island (193) and the Chatham Islands vanish, and those are precisely the zones that make
  the map interesting.
* `resolution=WxH` is the most principled knob for a screen map: it ties the simplification
  threshold to the pixel grid you will actually draw on.

### 4.2 Measured sizes: Natural Earth source (3.36 MB, 155,007 vertices)

Command shape:

```sh
mapshaper ne_10m_time_zones.geojson \
  -filter-fields tz_name1st,zone \
  -simplify visvalingam <PCT>% keep-shapes \
  -o precision=0.001 format=geojson out.json
```

| Retain % | GeoJSON `precision=0.001` | gzip -9 | brotli q11 |
| ---: | ---: | ---: | ---: |
| 10% | 332,016 | 100,810 | 61,949 |
| 5% | 200,004 | 58,195 | 37,481 |
| 3% | 149,455 | 41,700 | 27,758 |
| 2% | 124,156 | 33,887 | 22,598 |
| 1% | 100,113 | 26,430 | 17,768 |

Same input as TopoJSON:

| Retain % | q=1e4 | gzip | brotli | q=1e5 | gzip | brotli |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10% | 157,872 | 45,231 | 36,239 | 183,875 | 60,233 | 48,267 |
| 5% | 124,891 | 37,323 | 28,268 | 143,913 | 47,978 | 37,094 |
| 3% | 110,668 | 33,844 | 24,687 | 127,036 | 42,721 | 32,473 |
| 2% | 103,876 | 31,857 | 23,001 | 118,981 | 39,766 | 29,020 |
| 1% | 96,339 | 29,890 | 20,883 | 110,210 | 36,900 | 27,467 |

Without `-filter-fields`, the raw NE geojson at 10% is 366,467 bytes and at 1% is 134,564 bytes,
so dropping 13 dead property keys saves 25 to 35 KB on its own.

### 4.3 The dejurin recipe, for reference

`dejurin/simplified-timezone-boundaries` runs exactly this against the TBB shapefile
(verbatim from its `index.js`):

```
pnpm exec mapshaper ./dist/combined-shapefile.shp \
  -simplify visvalingam 0.21% \
  -filter remove-empty \
  -o precision=0.00001 output.geojson
```

That produced their 0.32 MB `output.geojson`. Note they do **not** use `keep-shapes`, which is why
their README warns that Monaco and the Vatican disappear.

### 4.4 Measured sizes: TBB `combined-with-oceans-now.json` (84.5 MB, 3,789,891 vertices, 64 features)

This is the one that matters. Command shape:

```sh
mapshaper build/combined-with-oceans-now.json \
  -filter-fields tzid \
  -simplify visvalingam <PCT>% keep-shapes \
  -o format=topojson quantization=1e4 zones.topojson
```

| Retain % | GeoJSON `precision=0.001` | gzip | brotli | TopoJSON q=1e4 | gzip | brotli | surviving points |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2% | 1,291,209 | 429,742 | 238,840 | **302,596** | 68,621 | 60,029 | 40,019 |
| 1% | 668,586 | 224,438 | 128,009 | **175,652** | 48,112 | 42,760 | 21,079 |
| 0.5% | 355,141 | 115,649 | 70,591 | **111,999** | 33,784 | 30,193 | 11,577 |
| 0.3% | 229,200 | 73,076 | 46,968 | 84,043 | 26,988 | 23,584 | |
| 0.2% | 157,543 | 48,111 | 33,061 | 64,755 | 21,371 | 18,538 | |

And the land only `combined-now.json` (63 features), for comparison:

| Retain % | GeoJSON | TopoJSON q=1e4 | gzip | brotli |
| ---: | ---: | ---: | ---: | ---: |
| 1% | 489,589 | 185,977 | 51,004 | 45,544 |
| 0.5% | 256,029 | 115,225 | 34,835 | 31,013 |
| 0.2% | 112,212 | 58,053 | 19,170 | 16,780 |
| 0.1% | 63,489 | 37,949 | 12,906 | 11,108 |

Method comparison at the same nominal 2% on the with-oceans input, all TopoJSON q=1e4:

| Setting | bytes | gzip | brotli | points |
| --- | ---: | ---: | ---: | ---: |
| `-simplify 2%` (weighted Visvalingam, default) | 302,124 | 67,676 | 59,140 | 39,992 |
| `-simplify dp 2%` | 302,576 | 68,660 | 59,793 | 40,064 |
| `-simplify interval=5km` | 158,932 | 44,494 | 39,438 | 18,629 |
| `-simplify resolution=2048x1024` | 107,144 | 32,414 | 28,911 | 10,944 |
| **`-simplify resolution=4096x2048`** | **161,166** | **44,961** | **39,853** | **18,969** |
| `-simplify resolution=8192x4096` | 253,235 | 60,556 | 53,597 | 32,739 |

**Recommendation: `-simplify resolution=4096x2048 keep-shapes` with TopoJSON `quantization=1e4`.**
It gives 161 KB raw, 45 KB gzip, 40 KB brotli, 18,969 retained points across 64 polygons, and it
is defensible: the threshold is exactly one cell of a 4096 x 2048 equirectangular grid, so on a
4K wide canvas no removed vertex could have moved a pixel.

### 4.5 TopoJSON quantisation and delta encoding, concretely

VERIFIED structure of the output:

```json
{"type":"Topology",
 "arcs":[[[4521,6148],[5,5],[-1,7],[4,25],[29,0], ...]],
 "transform":{"scale":[0.036003600360036005,0.018001800180018002],
              "translate":[-180,-90]},
 "objects":{"tz":{"type":"GeometryCollection","geometries":[
   {"type":"MultiPolygon","id":"Africa/Abidjan","properties":{"tzid":"Africa/Abidjan"},"arcs":[...]}
 ]}}}
```

What `quantization=1e4` buys you, all at once:

1. **Integerisation.** Every coordinate becomes an integer in `[0, 9999]`. `-180.0` becomes `0`,
   `180.0` becomes `9999`. That kills all the `-142.461143` style 9 character floats.
2. **Delta encoding.** Only the first point of an arc is absolute; the rest are integer deltas, so
   most numbers are 1 to 3 characters (`[5,5]`, `[-1,7]`, `[29,0]`). This is where the real win is,
   and it is exactly the pattern gzip and brotli devour.
3. **Shared arcs.** The 64 timezone polygons tile the globe, so every internal boundary is stored
   once, not twice. VERIFIED: at `resolution=4096x2048` the topology is 1,113 arcs / 40,019 points
   at 2% versus 3,789,891 raw vertices.

Grid resolution: `scale[0] = 360 / 9999 = 0.03600360 degrees`. At the equator that is about
4.0 km, or 0.38 px on a 3840 px wide equirectangular canvas. Comfortably sub pixel. `1e5` would be
0.038 px and costs 20 to 25% more bytes for nothing. **Use `1e4`. Do not go above it.**

Decoding in the browser needs `topojson-client` (67,594 B unpacked, tree shakes to almost nothing
if you only import `feature`):

```ts
import { feature } from 'topojson-client';
const topo = await (await fetch('/data/zones.topojson')).json();
const fc = feature(topo, topo.objects.tz);   // GeoJSON FeatureCollection, 64 features
```

If you would rather not ship even that, the decode is 15 lines: multiply by `transform.scale`, add
`transform.translate`, and run a prefix sum along each arc. Writing it yourself removes the
dependency and lets you decode straight into a `Float32Array` for WebGL, which you want anyway.

The alternative toolchain, `topojson-server` + `topojson-simplify`, works but is strictly worse
here: `topojson-simplify`'s `-p` planar area threshold has no notion of "keep small shapes", and
`geo2topo -q 1e4` alone (no simplification) on a 3.8 M vertex input would still be megabytes.
mapshaper does simplification, topology building, quantisation and field filtering in one pass.
Only reach for `topojson-simplify` if you need `-f` (filter rings by area) semantics that mapshaper
lacks. UNVERIFIED: exact `topojson-simplify` output sizes for this input; I did not run it because
mapshaper already met the budget.

### 4.6 The complete, tested build script

This ran end to end on this machine. VERIFIED output: `zones.topojson` = **162,576 bytes**
(brotli 40,032, gzip 45,173), `labels.geojson` = **7,479 bytes** (brotli 968, gzip 1,196),
64 features, ids present on all 64.

```js
// tools/build-timezones.mjs
// npm i -D mapshaper
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import mapshaper from 'mapshaper';
import zlib from 'node:zlib';

// Pin the tag. Swap 'tags/2026c' for 'latest' only when you deliberately want to re-baseline.
const TAG   = '2026c';
const REL   = `https://api.github.com/repos/evansiroky/timezone-boundary-builder/releases/tags/${TAG}`;
const ASSET = 'timezones-with-oceans-now.geojson.zip';
const WORK  = 'build';
await fs.mkdir(WORK, { recursive: true });

const rel   = await (await fetch(REL, { headers: { 'user-agent': 'heliograph-build' } })).json();
const asset = rel.assets.find(a => a.name === ASSET);
console.log('release', rel.tag_name, asset.name, (asset.size / 1048576).toFixed(1), 'MB');

const zipPath = `${WORK}/${ASSET}`;
try { await fs.access(zipPath); } catch {
  const r = await fetch(asset.browser_download_url);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(zipPath));
}
execFileSync('unzip', ['-o', zipPath, '-d', WORK], { stdio: 'inherit' });

const input = await fs.readFile(`${WORK}/combined-with-oceans-now.json`);

const cmds = [
  '-i tz.json',
  '-filter-fields tzid',
  '-simplify resolution=4096x2048 keep-shapes',
  '-o format=topojson quantization=1e4 id-field=tzid zones.topojson',
  '-points inner',
  '-o format=geojson precision=0.01 labels.geojson',
].join(' ');

const out = await mapshaper.applyCommands(cmds, { 'tz.json': input });
for (const [name, buf] of Object.entries(out)) {
  await fs.writeFile(`${WORK}/${name}`, buf);
  const br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
  console.log(name.padEnd(20), buf.length, 'bytes | brotli', br.length,
              '| gzip', zlib.gzipSync(buf, { level: 9 }).length);
}
```

VERIFIED mapshaper Node API surface on 0.7.52: the module exports exactly
`runCommands`, `applyCommands`, `runCommandsXL`, `enableLogging`. `applyCommands(cmdString, inputs)`
returns a `Promise<Record<string, Uint8Array>>` keyed by the output filenames in the command
string. `mapshaper.VERSION` is `undefined`, so do not try to read it.

Notes on the command string:

* The TopoJSON `objects` key comes from the **input filename**, so `-i tz.json` gives
  `topo.objects.tz`. Name the input deliberately.
* `id-field=tzid` sets `geometry.id` **and keeps** `properties.tzid` (VERIFIED: all 64 geometries
  have both). If you want the ~1.5 KB back, append a `-filter-fields` with no argument list after
  the id has been assigned, or just accept the duplication for the debuggability.
* `-points inner` runs on the already simplified layer and emits one guaranteed inside point per
  feature. VERIFIED sample: `Africa/Abidjan [-0.33,-20.68]`, `Europe/Paris [7.81,49.09]`,
  `America/Adak [-176.06,51.94]`. These are your clock label anchors. Note `Africa/Abidjan`'s inner
  point lands in the South Atlantic because the ocean band dominates the polygon's area, so you
  will want a hand tuned override table of about a dozen label positions on top.
* The pipeline is CPU cheap. mapshaper needs headroom for the 84 MB input; run node with
  `--max-old-space-size=8192` if you hit a heap error (the `mapshaper` bin already allocates it).

### 4.7 Coverage check (does the simplified layer tile the globe?)

VERIFIED. Decoded `resolution` variant back to GeoJSON with `topojson-client` and ray cast every
1 degree cell centre (64,800 points, holes honoured):

* **64,731 of 64,800 covered, 69 uncovered, 0.11%.**
* The uncovered cells are 68 in the high Arctic between 73 N and 84 N around longitudes
  -180 to -176, plus one at (-46.5, -74.5) in the Weddell Sea. This is a genuine gap in the TBB
  ocean data near the pole, not a simplification artefact.
* Spot checks all correct: Oslo -> `Europe/Paris`, New York -> `America/New_York`,
  Kiritimati -> `Pacific/Kiritimati`, Chatham -> `Pacific/Chatham`,
  Kathmandu -> `Asia/Kathmandu`, Lord Howe -> `Australia/Lord_Howe`,
  Eucla -> `Australia/Eucla`, mid Atlantic (0, -25) -> `America/Noronha` (UTC-2 nautical band),
  mid Pacific (0, -150) -> `Pacific/Honolulu` (UTC-10 nautical band),
  Apia -> `Pacific/Tongatapu`, South Pole -> `Pacific/Auckland`,
  North Pole -> `Africa/Abidjan` (UTC+0 band).

Practical consequence: fill the WebGL canvas with a neutral "no zone" colour first, then draw the
polygons on top. The 0.11% of the sphere with no polygon then reads as deliberate rather than as a
rendering bug.

### 4.8 Antimeridian handling

VERIFIED from the source data: TBB splits polygons at +/- 180. `Pacific/Auckland` is a
MultiPolygon of 11 parts with longitudes spanning `-180.00 .. 180.00`, meaning it has parts on both
sides and none of them wrap. Per feature longitude extents:

| tzid | parts | verts | lon min | lon max |
| --- | ---: | ---: | ---: | ---: |
| `Pacific/Auckland` | 11 | 16,703 | -180.00 | 180.00 |
| `Pacific/Kiritimati` | 8 | 2,441 | -160.61 | -149.99 |
| `Pacific/Tongatapu` | 22 | 5,012 | -179.40 | -170.51 |
| `Pacific/Chatham` | 1 | 1,160 | -177.24 | -175.54 |
| `Etc/GMT+12` | 2 | 11,442 | -180.00 | -172.50 |
| `Pacific/Pago_Pago` | 5 | 37,476 | -178.60 | -157.50 |
| `Asia/Sakhalin` | 13 | 53,432 | 138.69 | 172.50 |
| `Australia/Lord_Howe` | 1 | 226 | 158.80 | 159.52 |
| `Australia/Eucla` | 1 | 432 | 125.50 | 129.03 |
| `Antarctica/Troll` | 1 | **6** | 0.00 | 25.00 |

So an equirectangular renderer needs no antimeridian logic at all: just draw every ring as is.
`Antarctica/Troll` being a 6 vertex wedge is a nice reminder that the Antarctic "zones" are pie
slices, not real boundaries.

### 4.9 gzip or brotli, and whether it is worth it

The app must work offline with zero network requests at runtime, so the honest question is "how do
these bytes get to the client at all".

* **Served over HTTP from a dev server or a static host.** Precompress once at build time and let
  the server negotiate. For 162,576 bytes the wins are large in relative terms: brotli q11 takes
  it to 40,032 bytes, a **4.06x** reduction; gzip -9 gives 45,173 bytes, **3.60x**. Use
  `vite-plugin-compression` or emit `.br` and `.gz` siblings yourself in the build script above.
  UNVERIFIED: I did not test a specific Vite compression plugin.
* **Inlined into the JS bundle.** Do not. A 162 KB JSON literal parses slower than a `fetch` +
  `JSON.parse` of the same bytes, and it defeats HTTP caching.
* **Decompressing in JS.** Not needed, and not worth it: the browser's `DecompressionStream('gzip')`
  exists but adding a manual decompress step to save 120 KB of disk in a genuinely offline
  (file://) deployment is a bad trade against the added failure mode. If you truly ship to
  `file://` where `Content-Encoding` does not apply, 162 KB raw is already fine.
* **Do not double compress.** If the asset pipeline already brotli's everything, quantising harder
  than 1e4 buys almost nothing: 1e5 costs 25% more raw bytes but only 8 to 10% more brotli bytes,
  because brotli eats the redundant digits. Optimise the raw size anyway, since raw size is what
  `JSON.parse` pays for.

---

## 5. The `Intl` APIs, with tested code

All snippets in this section were executed on Node v24.18.0 (V8, ICU 78.3, tzdata 2026b) and the
outputs shown are real.

### 5.1 UTC offset in minutes, `formatToParts` approach

This is the portable one. It works in every engine that has `Intl.DateTimeFormat` with `timeZone`
support, which is everything since about 2018.

```ts
const _partsFmt = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = _partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',                    // critical: avoids "24" for midnight
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    _partsFmt.set(tz, f);
  }
  return f;
}

/** Minutes east of UTC for `tz` at instant `date`. +330 for Asia/Kolkata. */
export function tzOffsetMinutes(tz: string, date: Date = new Date()): number {
  const v: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type !== 'literal') v[p.type] = p.value;
  }
  const wallAsUTC = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second);
  // formatToParts has no milliseconds, so truncate the instant to whole seconds first
  const instant = Math.floor(date.getTime() / 1000) * 1000;
  return (wallAsUTC - instant) / 60000;
}
```

Three details that bite people:

* `hourCycle: 'h23'` is not optional. With the default `en-US` h12 cycle you get `hour: "12"` plus
  a `dayPeriod` part and midnight comes back as `24` in some locales, which throws
  `Date.UTC` off by a day.
* Truncating the instant to whole seconds is what makes the result exact. Without it you get
  fractional minute offsets for any `Date` with non zero ms.
* Cache the formatter. Constructing 63 of them took **13.96 ms**; formatting with cached ones is
  free by comparison.

### 5.2 UTC offset via `timeZoneName: 'longOffset'`

Newer and shorter. `longOffset` and `shortOffset` were added to ECMA-402 in ES2022.

```ts
const _offFmt = new Map<string, Intl.DateTimeFormat>();

export function tzOffsetMinutesLongOffset(tz: string, date: Date = new Date()): number {
  let f = _offFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    _offFmt.set(tz, f);
  }
  const s = f.formatToParts(date).find(p => p.type === 'timeZoneName')!.value;
  // "GMT" | "GMT+2" | "GMT-04:00" | "GMT+05:45" | "GMT+12:45"
  const m = /GMT(?:([+-])(\d{1,2})(?::?(\d{2}))?)?/.exec(s);
  if (!m || !m[1]) return 0;
  return (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + (+(m[3] ?? 0)));
}
```

VERIFIED: both functions agree on all 17 test zones including `Asia/Kathmandu` (+345),
`Pacific/Chatham` (+765), `Australia/Lord_Howe` (+630), `Antarctica/Troll` (+120 in August),
`America/St_Johns` (-150 in August).

The regex above is deliberately tolerant. VERIFIED forms actually produced by ICU 78.3:

| `timeZoneName` | `Asia/Kathmandu` | `Australia/Lord_Howe` | `America/New_York` | `Pacific/Chatham` | `Etc/GMT+12` | `Europe/Paris` |
| --- | --- | --- | --- | --- | --- | --- |
| `short` | `GMT+5:45` | `GMT+10:30` | `EDT` | `GMT+12:45` | `GMT-12` | `GMT+2` |
| `long` | `Nepal Time` | `Lord Howe Standard Time` | `Eastern Daylight Time` | `Chatham Standard Time` | `GMT-12:00` | `Central European Summer Time` |
| `shortOffset` | `GMT+5:45` | `GMT+10:30` | `GMT-4` | `GMT+12:45` | `GMT-12` | `GMT+2` |
| `longOffset` | `GMT+05:45` | `GMT+10:30` | `GMT-04:00` | `GMT+12:45` | `GMT-12:00` | `GMT+02:00` |
| `shortGeneric` | `Nepal Time` | `Lord Howe Island Time` | `ET` | `Chatham Islands Time` | `GMT-12` | `France Time` |
| `longGeneric` | `Nepal Time` | `Lord Howe Time` | `Eastern Time` | `Chatham Time` | `GMT-12:00` | `Central European Time` |

Note `longOffset` is **not** consistently zero padded: `GMT-04:00` but `GMT+12:45` and
`GMT+10:30`. Do not write `/GMT([+-])(\d{2}):(\d{2})/`.

**Which to use.** `formatToParts` for the numeric offset (it is the one you can also reuse to get
the wall clock fields in a single call), `longOffset` only when you want to *display* an offset
string. Measured cost: 63 zones x 1000 iterations took **38.5 ms** for `.format()`
(0.038 ms per frame for all 63 clocks) and **148.5 ms** for `.formatToParts()`
(0.149 ms per frame). Both are fine for 60 fps; `formatToParts` is 4x the cost of `format`.

### 5.3 Abbreviation and "is DST in effect"

There is no `Intl` API that tells you "is DST active". You derive it. The robust definition:
standard time is the **minimum** offset the zone takes during the year, because southern hemisphere
zones have their DST in January and a couple of zones (Ireland's negative summer time in tzdb
terms, Morocco's inverted Ramadan rule) invert the usual pattern.

```ts
export function tzAbbrev(tz: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(date).find(p => p.type === 'timeZoneName')!.value;
}

const _stdCache = new Map<string, number>();
/** The zone's standard-time offset in minutes for a given year. */
export function standardOffsetMinutes(tz: string, year: number): number {
  const k = `${tz}|${year}`;
  let v = _stdCache.get(k);
  if (v === undefined) {
    v = Infinity;
    for (let m = 0; m < 12; m++) {
      v = Math.min(v, tzOffsetMinutes(tz, new Date(Date.UTC(year, m, 1, 12))));
    }
    _stdCache.set(k, v);
  }
  return v;
}

export function isDST(tz: string, date = new Date()): boolean {
  return tzOffsetMinutes(tz, date) > standardOffsetMinutes(tz, date.getUTCFullYear());
}

/** How much DST, in minutes. 60 usually, 30 for Lord Howe, 120 for Antarctica/Troll. */
export function dstAmountMinutes(tz: string, date = new Date()): number {
  return tzOffsetMinutes(tz, date) - standardOffsetMinutes(tz, date.getUTCFullYear());
}
```

VERIFIED output at 2026-08-14T12:00:00Z and 2026-01-15T12:00:00Z:

| zone | Aug offset | Aug abbrev | Aug DST | DST amount | Jan offset | Jan DST | Jan abbrev |
| --- | ---: | --- | --- | ---: | ---: | --- | --- |
| `UTC` | 0 | `UTC` | false | 0 | 0 | false | `UTC` |
| `Europe/Oslo` | 120 | `GMT+2` | true | 60 | 60 | false | `GMT+1` |
| `Europe/London` | 60 | `GMT+1` | true | 60 | 0 | false | `GMT` |
| `America/New_York` | -240 | `EDT` | true | 60 | -300 | false | `EST` |
| `Asia/Kolkata` | 330 | `GMT+5:30` | false | 0 | 330 | false | `GMT+5:30` |
| `Asia/Kathmandu` | 345 | `GMT+5:45` | false | 0 | 345 | false | `GMT+5:45` |
| `Pacific/Chatham` | 765 | `GMT+12:45` | false | 0 | 825 | **true** | `GMT+13:45` |
| `Australia/Lord_Howe` | 630 | `GMT+10:30` | false | 0 | 660 | **true** | `GMT+11` |
| `Pacific/Kiritimati` | 840 | `GMT+14` | false | 0 | 840 | false | `GMT+14` |
| `Pacific/Apia` | 780 | `GMT+13` | false | 0 | 780 | false | `GMT+13` |
| `Pacific/Auckland` | 720 | `GMT+12` | false | 0 | 780 | **true** | `GMT+13` |
| `Australia/Eucla` | 525 | `GMT+8:45` | false | 0 | 525 | false | `GMT+8:45` |
| `Asia/Tehran` | 210 | `GMT+3:30` | false | 0 | 210 | false | `GMT+3:30` |
| `America/St_Johns` | -150 | `GMT-2:30` | true | 60 | -210 | false | `GMT-3:30` |
| `Antarctica/Troll` | 120 | `GMT+2` | true | **120** | 0 | false | `GMT` |
| `Pacific/Marquesas` | -570 | `GMT-9:30` | false | 0 | -570 | false | `GMT-9:30` |
| `Asia/Yangon` | 390 | `GMT+6:30` | false | 0 | 390 | false | `GMT+6:30` |

Note `timeZoneName: 'short'` only gives a real abbreviation (`EDT`, `EST`) for a handful of North
American zones in `en-US`; everywhere else it falls back to `GMT+N`. If you want "CEST" style
labels for Europe you must ship your own table, because CLDR does not carry them for `en`.
UNVERIFIED: whether other locales (`de-DE`, `fr-FR`) return native abbreviations; not tested.

### 5.4 Listing all zones, and the fallback

```ts
export function listTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') {
    try { return Intl.supportedValuesOf('timeZone'); } catch { /* fall through */ }
  }
  return FALLBACK_ZONE_LIST;   // ship your own
}

export function isUsableZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; }
  catch { return false; }      // RangeError
}
```

VERIFIED behaviour on Node 24.18 / ICU 78.3:

* `Intl.supportedValuesOf('timeZone').length === 418`
* **It does not contain `"UTC"`.** It does not contain `"Etc/UTC"`. It contains **zero** `Etc/*`
  entries.
* It contains **old style link names**, not the modern primaries:
  `Asia/Calcutta` (not `Asia/Kolkata`), `Asia/Katmandu`, `Asia/Rangoon`, `Asia/Saigon`,
  `Europe/Kiev`, `America/Godthab`, `Atlantic/Faeroe`, `Pacific/Enderbury`.
* It does not contain `Antarctica/Mirny` at all, and `new Intl.DateTimeFormat('en',
  {timeZone:'Antarctica/Mirny'})` **throws `RangeError`** in this build. It does contain
  `Antarctica/Casey, Davis, DumontDUrville, Macquarie, Mawson, McMurdo, Palmer, Rothera, Syowa,
  Troll, Vostok`.

MDN's baseline note: `Intl.supportedValuesOf` has been "well established and works across many
devices and browser versions" since **March 2022**.
Source: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf>

**What to do when unsupported, or when it disagrees with your data.** For this app you never need
the full 418 anyway. Ship your own list: it is exactly the 64 ids in your TopoJSON, which is what
you draw and clock. Use `supportedValuesOf` only to power an optional "jump to a city's zone"
search box, and always guard every id with `isUsableZone` before handing it to a formatter, since
your build machine's tzdata and the user's browser's tzdata can differ by a year or two.

### 5.5 Wall clock time in a zone, to a UTC instant, done correctly

The naive "two pass offset guess" that most blog posts show is **wrong for the ambiguous hour**.
VERIFIED failure: for `Europe/Oslo` at wall time `2026-10-25 02:30`, the naive algorithm probes the
offset at the naive instant (`2026-10-25T02:30Z`, which is after the 01:00 UTC transition, so +60),
subtracts it to get `01:30Z`, probes again, gets +60 again, sees no change, and returns a single
answer. It never notices the hour repeats.

The correct algorithm is the one `Temporal.ZonedDateTime.from` specifies. Probe the offset a full
day **before** and a full day **after** the naive instant, build both candidate instants, and keep
only the candidates that round trip. You then get 0, 1 or 2 possible instants, which is exactly the
gap / normal / ambiguous trichotomy.

```ts
const DAY_MS = 86_400_000;

export type Disambiguation = 'compatible' | 'earlier' | 'later' | 'reject';

/** All UTC instants at which the wall clock in `tz` reads the given fields. 0, 1, or 2 of them. */
export function possibleInstants(
  tz: string, y: number, mo: number, d: number, h: number, mi: number, s = 0,
): number[] {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  const oBefore = tzOffsetMinutes(tz, new Date(naive - DAY_MS));
  const oAfter  = tzOffsetMinutes(tz, new Date(naive + DAY_MS));
  const cands = [...new Set([naive - oBefore * 60000, naive - oAfter * 60000])].sort((a, b) => a - b);
  return cands.filter(t => tzOffsetMinutes(tz, new Date(t)) * 60000 === naive - t);
}

export function zonedWallTimeToUTC(
  tz: string, y: number, mo: number, d: number, h: number, mi: number, s = 0,
  disambiguation: Disambiguation = 'compatible',
): number {
  const p = possibleInstants(tz, y, mo, d, h, mi, s);

  if (p.length === 1) return p[0];

  if (p.length > 1) {                       // AMBIGUOUS: clocks went back, the hour repeats
    if (disambiguation === 'reject') throw new RangeError(`ambiguous local time in ${tz}`);
    if (disambiguation === 'later') return p[p.length - 1];
    return p[0];                            // 'compatible' and 'earlier' both take the first
  }

  // NONEXISTENT: clocks went forward, this wall time never happened
  if (disambiguation === 'reject') throw new RangeError(`nonexistent local time in ${tz}`);
  const naive   = Date.UTC(y, mo - 1, d, h, mi, s);
  const oBefore = tzOffsetMinutes(tz, new Date(naive - DAY_MS));
  const oAfter  = tzOffsetMinutes(tz, new Date(naive + DAY_MS));
  const gapMin  = oAfter - oBefore;
  if (disambiguation === 'earlier') return naive - oBefore * 60000 - gapMin * 60000;
  return naive - oBefore * 60000;           // 'compatible' and 'later': skip forward over the gap
}
```

**VERIFIED test matrix.** "renders back as" is the result of formatting the returned instant with
`Intl.DateTimeFormat('en-GB', {timeZone, dateStyle:'short', timeStyle:'medium', hourCycle:'h23'})`.

| Zone, wall time | possible | `compatible` | `earlier` | `later` |
| --- | ---: | --- | --- | --- |
| `Europe/Oslo` 2026-03-29 02:30 (gap) | **0** | `01:30Z` -> 03:30 | `00:30Z` -> 01:30 | `01:30Z` -> 03:30 |
| `Europe/Oslo` 2026-10-25 02:30 (ambiguous) | **2** | `00:30Z` -> 02:30 (+120) | `00:30Z` -> 02:30 | `01:30Z` -> 02:30 (+60) |
| `Europe/Oslo` 2026-07-01 12:00 (normal) | **1** | `10:00Z` -> 12:00 | same | same |
| `America/New_York` 2026-03-08 02:30 (gap) | **0** | `07:30Z` -> 03:30 | `06:30Z` -> 01:30 | `07:30Z` -> 03:30 |
| `America/New_York` 2026-11-01 01:30 (ambiguous) | **2** | `05:30Z` -> 01:30 (-240) | `05:30Z` | `06:30Z` -> 01:30 (-300) |
| `Australia/Lord_Howe` 2026-04-05 01:45 (ambiguous, 30 min) | **2** | `2026-04-04T14:45Z` (+660) | same | `2026-04-04T15:15Z` (+630) |
| `Australia/Lord_Howe` 2026-10-04 02:15 (gap, 30 min) | **0** | `15:45Z` -> 02:45 | `15:15Z` -> 01:45 | `15:45Z` -> 02:45 |
| `Pacific/Chatham` 2026-04-05 03:15 (ambiguous, +12:45 zone) | **2** | `2026-04-04T13:30Z` (+825) | same | `2026-04-04T14:30Z` (+765) |
| `Pacific/Apia` 2011-12-30 12:00 (**a whole day was skipped**) | **0** | `2011-12-30T22:00Z` -> 31/12 12:00 | `2011-12-29T22:00Z` -> 29/12 12:00 | 31/12 |

**Which disambiguation policy should the heliograph use? `'compatible'`.**

Reasons:
* It is the `Temporal` default, so behaviour matches the platform when you eventually migrate off
  the polyfill code above.
* It is also what `java.time`, `moment-timezone`, `luxon` and `date-fns-tz` all default to (the
  "prefer the earlier offset for ambiguity, push forward across a gap" rule).
* For a scrubber, `'reject'` is actively hostile: dragging a time slider through 02:30 on a spring
  forward morning must not throw. `'compatible'` makes the slider jump the gap, which is exactly
  what the world does.
* Expose `'earlier'` / `'later'` only if you build an explicit "the clock said 01:30 twice" UI.

**The heliograph specific point**: the scrubber's own state should be a **UTC instant**, never a
wall clock. Convert wall clock to instant once, when the user types a date into a box or picks a
"local noon here" preset. Every subsequent operation (animation, the subsolar point, the terminator)
is a pure function of the UTC instant, so gaps and ambiguity never enter the render loop.

### 5.6 The fast path for animation: precompute the transition table

Calling `formatToParts` 63 times per frame is affordable (0.149 ms) but wasteful when scrubbing a
year at 60 fps. Better: find every transition in the visible window once, then do integer
arithmetic in the loop.

```ts
export interface Transition { at: number; from: number; to: number; }  // ms epoch, minutes, minutes

/** All offset transitions of `tz` in [t0, t1), located to the minute. */
export function transitions(tz: string, t0: number, t1: number, step = 6 * 3600_000): Transition[] {
  const out: Transition[] = [];
  let prev = tzOffsetMinutes(tz, new Date(t0));
  let a = t0;
  for (let t = t0 + step; t <= t1; t += step) {
    const o = tzOffsetMinutes(tz, new Date(t));
    if (o !== prev) {
      let lo = a, hi = t;                                   // bisect down to one minute
      while (hi - lo > 60000) {
        const mid = lo + Math.floor((hi - lo) / 2 / 60000) * 60000;
        if (tzOffsetMinutes(tz, new Date(mid)) === prev) lo = mid; else hi = mid;
      }
      out.push({ at: hi, from: prev, to: o });
      prev = o;
    }
    a = t;
  }
  return out;
}
```

VERIFIED: scanning **all 63 "now" zones over calendar year 2026 found 58 transitions in 275 ms**.
Only **29 of 63 zones** transition at all. Cache that table keyed by year and the render loop
becomes a binary search plus an integer add.

Sample of the real 2026 table:

```
Africa/Cairo       2026-04-23T22:00Z 120->180   |  2026-10-29T21:00Z 180->120
Africa/Casablanca  2026-02-15T02:00Z  60->0     |  2026-03-22T02:00Z   0->60
Europe/Paris       2026-03-29T01:00Z  60->120   |  2026-10-25T01:00Z 120->60
America/Adak       2026-03-08T12:00Z -600->-540 |  2026-11-01T11:00Z -540->-600
America/Anchorage  2026-03-08T11:00Z -540->-480 |  2026-11-01T10:00Z -480->-540
America/Denver     2026-03-08T09:00Z -420->-360 |  2026-11-01T08:00Z -360->-420
America/Chicago    2026-03-08T08:00Z -360->-300 |  2026-11-01T07:00Z -300->-360
America/New_York   2026-03-08T07:00Z -300->-240 |  2026-11-01T06:00Z -240->-300
America/Halifax    2026-03-08T06:00Z -240->-180 |  2026-11-01T05:00Z -180->-240
America/Havana     2026-03-08T05:00Z -300->-240 |  2026-11-01T05:00Z -240->-300
```

The only two zones in 2026 whose step is **not** 60 minutes (VERIFIED, exhaustive):

```
Antarctica/Troll     0 -> 120  (+120 min) @ 2026-03-29T01:00Z ; 120 -> 0 @ 2026-10-25T01:00Z
Australia/Lord_Howe  660 -> 630 (-30 min) @ 2026-04-04T15:00Z ; 630 -> 660 @ 2026-10-03T15:30Z
```

Note Morocco: `Africa/Casablanca` goes **backwards** in February and forwards in March. It is
permanently on UTC+1 and drops to UTC+0 for Ramadan, so `isDST()` returns `true` for most of the
year and `false` during Ramadan. That is correct by the minimum offset definition, and it will look
strange if you label it "Summer Time". Label DST as a colour tint, not as a word.

---

## 6. Pitfalls, and how each should look on the map

### 6.1 Do not model offsets as integer hours. Ever.

VERIFIED offsets currently in use among the 63 "now" zones:

| Offset | Minutes | Zone(s) | Rendering note |
| --- | ---: | --- | --- |
| UTC+05:30 | 330 | `Asia/Kolkata` (also Sri Lanka) | One clean band across India and Sri Lanka. Do **not** split India, it has been one zone since 1906. |
| UTC+05:45 | 345 | `Asia/Kathmandu` | A narrow sliver, 80.06 E to 88.20 E, 22,172 vertices in the source. It sits **inside** India's UTC+5:30 band as a distinct colour. This is one of the most satisfying details on the whole map; do not simplify it away. |
| UTC+04:30 | 270 | `Asia/Kabul` | Afghanistan sized band, 30 minutes off both neighbours. |
| UTC+03:30 | 210 | `Asia/Tehran` | Iran. **No DST since 2022**, so its edge stays still all year. |
| UTC+06:30 | 390 | `Asia/Yangon` | Myanmar, plus `Indian/Cocos` in the comprehensive product. |
| UTC+08:45 | 525 | `Australia/Eucla` | Roughly 200 people. 432 vertices, 125.5 E to 129.03 E. `keep-shapes` is what saves it. |
| UTC+09:30 / +10:30 | 570 / 630 | `Australia/Darwin` (no DST) / `Australia/Adelaide` (DST) | Two adjacent bands with the same standard offset but different DST behaviour. Colour them differently or the summer map looks wrong. |
| UTC+10:30 / +11:00 | 630 / 660 | `Australia/Lord_Howe` | See 6.2. |
| UTC+12:45 / +13:45 | 765 / 825 | `Pacific/Chatham` | See 6.3. |
| UTC-03:30 / -02:30 | -210 / -150 | `America/St_Johns` | Newfoundland, and it does have DST, so it swings between -3:30 and -2:30. |
| UTC-09:30 | -570 | `Pacific/Marquesas` | 4 tiny islands, 1,963 vertices. |
| UTC-04:00 (fixed) | -240 | `America/Caracas` | Venezuela reverted from -4:30 to -4:00 in 2016. Natural Earth still says `zone: -4.5`. Another reason not to trust NE. |

Implementation rule: the offset in your model is **an integer number of minutes**, always. A
`Float32` uniform holding "hours" will produce a visible half pixel seam at the Nepal boundary once
you multiply by 15 degrees per hour.

### 6.2 Lord Howe Island: 30 minute DST

`Australia/Lord_Howe` is UTC+10:30 in the southern winter and UTC+11:00 in the southern summer.
It is the **only inhabited place on Earth with a 30 minute DST step** (VERIFIED against all 63
zones for 2026; the only other non 60 minute step is Antarctica/Troll's 120 minutes).

VERIFIED 2026 transitions: `660 -> 630 @ 2026-04-04T15:00Z` and `630 -> 660 @ 2026-10-03T15:30Z`.
Note the second one happens at `:30` past the hour in UTC, because 02:00 local at +10:30 is 15:30Z.

**On the map:** the polygon is 1 part, 226 vertices, 158.80 E to 159.52 E, about 0.7 degrees wide.
At a 3840 px equirectangular width that is **7 pixels**. It will disappear at any sane
simplification unless you use `keep-shapes` (VERIFIED: it survives `resolution=4096x2048
keep-shapes`). It should get:
* Its own fill colour, distinct from `Australia/Sydney` next door.
* A leader line to an off island label, since a 7 px island cannot hold "Lord Howe Time, 01:45".
* A visible half step in any "offset ruler" UI you draw along the bottom of the screen. If you
  quantise the ruler to hours it silently lies about this island.

### 6.3 Chatham Islands: UTC+12:45 and UTC+13:45

`Pacific/Chatham` is 45 minutes ahead of New Zealand and has full 60 minute DST on the NZ schedule,
so it takes the two strangest offsets in regular use.

VERIFIED: +765 minutes in August, +825 in January, abbreviations `GMT+12:45` and `GMT+13:45`,
`longGeneric` name "Chatham Time". VERIFIED ambiguity handling: wall time 2026-04-05 03:15 has
**2** possible instants, `2026-04-04T13:30Z` (+825) and `2026-04-04T14:30Z` (+765).

**On the map:** 1 polygon, 1,160 vertices, longitude -177.24 to -175.54, latitude -44.63 to -43.31.
So it sits **just west of the antimeridian on the negative side**, about 1.7 degrees wide. Same
treatment as Lord Howe: unique colour, off island leader line. If your legend sorts zones by offset,
Chatham must sort between +12 and +13, not get rounded into either.

### 6.4 UTC+13 and UTC+14, and why the "24 hour" world is really 26 hours

VERIFIED current inhabitants of the extreme east:

| Offset | Zones (in the 63 set) | Notes |
| --- | --- | --- |
| **UTC+14** | `Pacific/Kiritimati` | Kiribati's Line Islands. First place on Earth to see each new day. |
| **UTC+13** | `Pacific/Tongatapu` (Tonga, plus `Pacific/Apia`/Samoa and `Pacific/Fakaofo`/Tokelau in the group) | VERIFIED: `Pacific/Apia` offset is +780 in both January and August, no DST since 2021 |
| **UTC+13 (summer only)** | `Pacific/Auckland`, `Pacific/Fiji` | NZ is +12 standard, +13 in the southern summer |
| **UTC+13:45 (summer only)** | `Pacific/Chatham` | |
| **UTC-12** | `Etc/GMT+12` | Uninhabited, Baker and Howland Islands. The nautical band nobody lives in. |

The total spread is therefore **26 hours** (UTC-12 to UTC+14), and at any instant there are up to
**three different calendar dates** on Earth simultaneously (for about two hours a day, when it is
still "yesterday" at UTC-11 and already "tomorrow" at UTC+14).

**On the map:** this is a headline feature for a heliograph, not a pitfall to hide.
* Draw the **International Date Line** as its own layer, derived not from a straight meridian but
  from the actual boundary between the highest positive offset polygon and its negative neighbour.
  Because you have the polygons, the real, kinked date line falls out for free.
* Consider a "date under the cursor" readout, or a subtle date label per zone, so the user can see
  it is Saturday in Kiritimati and Friday in Honolulu at the same instant.
* Make sure the equirectangular canvas does not wrap: `Pacific/Kiritimati` at UTC+14 is drawn at
  longitude **-160 to -150**, on the far left of a -180 centred map, while `Asia/Sakhalin` at UTC+11
  is at +138 to +172 on the far right. The colour ramp must be keyed on the **offset value**, not
  on longitude, or the two ends of the map will not match.

### 6.5 The Kiribati bulge across the date line

Kiribati straddles the 180th meridian. In 1995 it moved the date line east so the whole country
shares one date, which put the Line Islands on **UTC+14 at longitude 157 W**, that is, 14 hours
ahead while sitting in the western hemisphere.

VERIFIED geometry in the with-oceans-now product:

```
Pacific/Kiritimati  8 parts, 2,441 verts, lon -160.61 .. -149.99, lat -11.65 .. 4.90
```

Note that this is **only the islands plus territorial waters**, not a full ocean strip. TBB uses
territorial waters, not EEZ, so the surrounding open ocean at that longitude is `Pacific/Honolulu`
(the UTC-10 nautical band). VERIFIED: a point at (0, -150) resolves to `Pacific/Honolulu`.

**On the map**, this means the correct rendering is a **scatter of small UTC+14 dots embedded in a
UTC-10 ocean**, a full 24 hour discontinuity. That is visually spectacular and completely correct.
Do not "fix" it by filling the ocean around Kiribati with +14. Two consequences:
* Your zone colour ramp must handle adjacent polygons that are 24 hours apart without producing an
  ugly clash. Map the colour to `offset mod 24` on a **cyclic** hue wheel, so +14 and -10 land on
  the same hue and the dots read as "the same time of day, a different date". That is the truthful
  encoding.
* Add a "date differs from neighbour" outline (a dashed stroke) rather than relying on hue, since
  a cyclic ramp deliberately hides the 24 hour jump.

The comprehensive TBB product also carries `Pacific/Enderbury` / `Pacific/Kanton` (the Phoenix
Islands, UTC+13). In the "now" product these merge into `Pacific/Tongatapu`. Be aware that
`Pacific/Kanton` is the modern primary but ICU 78.3 still canonicalises it to `Pacific/Enderbury`
(VERIFIED, section 2.2 Tier 4).

### 6.6 Other traps worth a line each

* **`Etc/GMT+N` has an inverted sign.** VERIFIED: `Etc/GMT+12` is UTC-12, `Etc/GMT-14` is UTC+14.
  If you synthesise these, get it right or half the ocean will be on the wrong side of the map.
* **`Intl.supportedValuesOf('timeZone')` omits `UTC` and every `Etc/*`** in ICU 78.3 (VERIFIED),
  yet `DateTimeFormat` accepts them. Validate with try/catch, never with `.includes()`.
* **Antarctica has no real zones.** In the "now" product only `Antarctica/Troll` survives as its own
  polygon, a 6 vertex wedge from 0 E to 25 E, and the rest of the continent is swallowed by
  `Pacific/Auckland` (the South Pole resolves there, VERIFIED). Do not draw confident zone
  boundaries across Antarctica. Hatch it, and pin station clocks if you want detail.
* **The high Arctic near the antimeridian has a genuine data gap** (68 uncovered 1 degree cells,
  section 4.7). Paint a base colour under everything.
* **Latitude 90.000206** appears in the Natural Earth bbox (VERIFIED). If you use NE for anything,
  clamp latitudes to +/- 90 before projecting or you get NaNs in a Mercator.
* **Time zone data goes stale.** The browser's tzdata is whatever the OS or the browser bundled.
  A user on an old device will disagree with your build. Show the data vintage (TBB tag `2026c`,
  and `new Intl.DateTimeFormat().resolvedOptions().timeZone` for the local zone) in an About panel
  so a disagreement is explicable rather than a bug report.
* **Do not use `Date.prototype.getTimezoneOffset()`** for anything except the user's own zone. It
  only knows the host zone, and its sign is inverted relative to every other convention (it returns
  `-120` for UTC+2).

---

## 7. Concrete shipping plan

**Data files in `public/data/` (total 170,055 bytes raw, about 41 KB brotli):**

| File | Bytes | Contents |
| --- | ---: | --- |
| `zones.topojson` | 162,576 | 64 polygons, quantised 1e4, `id` = IANA tzid |
| `zone-labels.geojson` | 7,479 | 64 inner points for clock placement |
| `zone-aliases.json` | ~9,250 | copy of `timezone-names-with-oceans-Now.json`, for search |

**Runtime code, no dependencies beyond a 15 line TopoJSON decoder:**

1. Fetch and decode `zones.topojson` into `Float32Array` vertex buffers, one draw range per zone.
2. On load, build the 2026 (or current year) transition table with `transitions()` for the 63
   zones that need it. 275 ms once, off the main thread if you like.
3. Render loop takes a UTC instant. Offsets come from a binary search in the transition table, so
   zero `Intl` calls per frame.
4. Clock text uses cached `Intl.DateTimeFormat` per zone (0.038 ms for all 63) or, better, pure
   integer arithmetic from the offset you already have.
5. Zone names for display use `timeZoneName: 'longGeneric'`, not the raw tzid.

---

## 8. Sources

* Natural Earth GeoJSON, fetched and parsed: <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson>
* Natural Earth commit history: <https://api.github.com/repos/nvkelso/natural-earth-vector/commits?path=geojson/ne_10m_time_zones.geojson>
* Natural Earth timezones page: <https://www.naturalearthdata.com/downloads/10m-cultural-vectors/timezones/>
* timezone-boundary-builder releases API: <https://api.github.com/repos/evansiroky/timezone-boundary-builder/releases>
* timezone-boundary-builder 2026c: <https://github.com/evansiroky/timezone-boundary-builder/releases/tag/2026c>
* timezone-boundary-builder README: <https://github.com/evansiroky/timezone-boundary-builder/blob/master/README.md>
* node-geo-tz README and `src/find.ts`: <https://github.com/evansiroky/node-geo-tz>
* dejurin/simplified-timezone-boundaries: <https://github.com/dejurin/simplified-timezone-boundaries>
* treyerl/timezones: <https://github.com/treyerl/timezones>
* candu/efele-tz-world-geojson: <https://github.com/candu/efele-tz-world-geojson>
* npm registry metadata for `tz-lookup`, `@photostructure/tz-lookup`, `geo-tz`, `mapshaper`, `topojson-server`, `topojson-simplify`, `topojson-client`: <https://registry.npmjs.org/>
* @photostructure/tz-lookup README (accuracy and speed numbers): <https://github.com/photostructure/tz-lookup>
* MDN `Intl.supportedValuesOf`: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf>
* mapshaper command reference: <https://github.com/mbloch/mapshaper/wiki/Command-Reference>
