# Typography and page shell for the heliograph

Research reference for the type system, font pipeline, dark UI craft, motion and layout of a
full bleed, offline, dark scientific instrument.

**Status legend used throughout**

| Tag | Meaning |
|---|---|
| VERIFIED (measured) | I ran the measurement on this machine and the numbers are in this document. Reproduction scripts are in the appendix. |
| VERIFIED (source) | Quoted or derived from a primary source, URL cited inline. |
| UNVERIFIED | Judgement, convention, or a claim I could not confirm against a primary source. Treated as advice, not fact. |

**Measurement environment for everything tagged "measured"**

- Windows 11 Enterprise 26100, Chromium / Firefox / WebKit via Playwright.
- GPU: `ANGLE (Intel, Intel(R) Arc(TM) 140T GPU (32GB) (0x00007D51) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- Display refresh 72 Hz, so one vsync is 13.89 ms. That is the floor for any frame timing below.
- fontTools 4.63.0 with brotli, harfbuzzjs via subset-font 2.5.0, Node 24.18.0.

---

## 1. Three type pairings

### 1.0 What I ruled out and why

The brief bans Inter, Space Grotesk, Playfair Display and the cream plus serif plus terracotta
editorial look. I also avoided the wider set of faces that currently signal "generated": Poppins,
Montserrat, DM Sans, DM Serif Display, Geist and Geist Mono, Instrument Serif, Bricolage
Grotesque, Sora, Manrope, Outfit, Plus Jakarta Sans, General Sans, Satoshi, Cabinet Grotesk,
JetBrains Mono, Fira Code, IBM Plex Sans. (UNVERIFIED: this is a taste judgement, not a
measurement.)

The vernacular I aimed at instead is concrete and checkable:

- **Nautical charts and almanac title pages** used Didones and engraved romans. Bodoni Moda is a
  direct descendant.
- **Ephemeris and nautical almanac tables** are dense lining figure tables with optical size
  adjusted text. Newsreader has a real `opsz` axis and is tabular by default.
- **Instrument bezels, control panel legends and stencilled signage** are extremely condensed
  grotesques with width variation. Big Shoulders and Saira live there.
- **Teleprinters, plotters and telemetry** are wide monospaces. Martian Mono and Recursive at
  `MONO=1` live there.

### 1.1 Verification method

Every family below was verified three ways:

1. `METADATA.pb` from the `google/fonts` repository, giving the published family name, designer,
   `license: "OFL"`, and the exact `fvar` axis tags with min and max. Example URL:
   `https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/METADATA.pb`
2. `OFL.txt` from the same directory, checked for a Reserved Font Name clause.
3. The actual variable TTF downloaded from `google/fonts` and opened with fontTools to read the
   `GSUB`/`GPOS` feature list, `hmtx` advance widths, `cmap` coverage and `OS/2` metrics.

**All ten families below are SIL Open Font License 1.1 and none of them carry a Reserved Font
Name clause.** VERIFIED (source), from each `OFL.txt` header, all of which use the modern
"Copyright YYYY The <Family> Project Authors" form with no RFN.

Practical consequence: you may subset, instance, rename and embed them freely. You must ship the
`OFL.txt` alongside (I recommend `public/fonts/OFL-<family>.txt` plus a `THIRD-PARTY.md`), you
must not sell the font files themselves, and derivative font files must stay under OFL.
Full licence text: https://openfontlicense.org/open-font-license-official-text/

### 1.2 Verified family data

| Published family name | Designer | Variable | Axes (tag: min..max) | Category |
|---|---|---|---|---|
| Bodoni Moda | Owen Earl | yes | `opsz` 6..96, `wght` 400..900 (plus a separate Italic file) | serif / Didone |
| Archivo | Omnibus-Type | yes | `wdth` 62..125, `wght` 100..900 (plus Italic) | grotesque |
| Martian Mono | Roman Shamin, Evil Martians | yes | `wdth` 75..112.5, `wght` 100..800 | monospace |
| Newsreader | Production Type | yes | `opsz` 6..72, `wght` 200..800 (plus Italic) | serif |
| Instrument Sans | Rodrigo Fuenzalida, Jordan Egstad | yes | `wdth` 75..100, `wght` 400..700 (plus Italic) | neo grotesque |
| Sometype Mono | Ryoichi Tsunekawa | yes | `wght` 400..700 (plus Italic) | monospace |
| Big Shoulders | Patric King | yes | `opsz` 10..72, `wght` 100..900 | condensed display |
| Saira | Omnibus-Type | yes | `wdth` 50..125, `wght` 100..900 (plus Italic) | technical grotesque |
| Recursive | Arrow Type, Stephen Nixon | yes | `MONO` 0..1, `CASL` 0..1, `wght` 300..1000, `slnt` -15..0, `CRSV` 0..1 | sans and mono superfamily |
| Doto | Óliver Lalan | yes | `ROND` 0..100, `wght` 100..900 | dot matrix display |

VERIFIED (source), each from its own `METADATA.pb`.

Note the family rename: the older `Big Shoulders Display` (axes `wght` only) still exists at
`ofl/bigshouldersdisplay`, but the current family is plain **Big Shoulders** at `ofl/bigshoulders`
with `opsz` 10..72 and `wght` 100..900. Use the new one.

### 1.3 Verified OpenType feature inventory (full upstream fonts)

This is the table that actually decides the pairings, because it tells you which faces can hold a
ticking clock still.

| Family | `tnum` | `zero` | `case` | small caps | Other notable |
|---|---|---|---|---|---|
| Archivo | yes | yes | yes | no | `lnum onum pnum ordn frac sups sinf subs aalt` |
| Saira | yes | yes | yes | no | `ss01 ss02 titl salt lnum onum frac` |
| Instrument Sans | yes | no | yes | no | `ss01`..`ss12`, `ordn`, `pnum` |
| Bodoni Moda | yes | no | yes | `smcp` + `c2sc` | `ss01 ss02 ss03 hlig dlig onum lnum` |
| Newsreader | yes (no op) | no | yes | no | `pnum sups ordn` only. Sparse on purpose. |
| Big Shoulders | **no** | no | yes | `smcp` + `c2sc` | `ss01 salt dlig` |
| Martian Mono | no (mono) | no | yes | no | `calt cv01 cv02 frac sups sinf subs` |
| Sometype Mono | no (mono) | no | yes | no | `calt salt frac sups sinf subs` |
| Recursive | no (mono-width by design) | **yes** | yes | no | `ss01`..`ss12`, `ss20`, `titl`, `dlig`, `afrc` |
| Doto | **none at all** | no | no | no | No `GSUB`, no `GPOS`, no kerning. |

VERIFIED (measured): read from the `GSUB`/`GPOS` FeatureList of each upstream variable TTF.

Two things to internalise from this table:

- **Big Shoulders has no `tnum` and its digits are proportional.** Confirmed in three browsers in
  section 3. It is a titling face only. Never put a number in it.
- **Doto has literally no OpenType tables.** No kerning, no ligatures, no features. That is fine
  because it is a fixed pitch dot grid, but it means no `tnum`, no `zero`, no `case`, and any code
  that assumes `font-feature-settings` will do something must not target it.

### 1.4 Verified digit advance widths (this is the clock jitter table)

Advance width of the digits `0`-`9` measured from `hmtx`, expressed in font units and normalised
to `em`. Where a family has `.tf` tabular glyphs, the `tnum` column is those.

| Family | upem | Default digits (units) | Default equal width? | `tnum` digits (units) | `tnum` em | `tnum` stable across `wght`? |
|---|---|---|---|---|---|---|
| Instrument Sans | 1000 | 391..666, 9 distinct | no | **600** | 0.600 | **yes: 600 at wght 400, 550 and 700** |
| Saira | 1000 | 365..682, 9 distinct | no | **620** | 0.620 | **yes: 620 at wght 100, 500 and 900** |
| Archivo | 1000 | 575..577 | no | 579 (default instance) | 0.579 | **no: 556 @100, 573 @500, 667 @900** |
| Bodoni Moda | 2000 | 869..1239 | no | 1160 (default) | 0.580 | **no: 1160 @400, 1256 @650, 1400 @900** |
| Newsreader | 2000 | 1100, all equal | **yes** | 1100 (`tnum` is an identity map) | 0.550 | **no: 1100 @200, 1140 @500, 1300 @800** |
| Martian Mono | 1000 | 750, all equal | yes | n/a | 0.750 | yes, at every weight |
| Recursive | 1000 | 600, all equal | yes | n/a | 0.600 | **yes at every position of every axis, including `MONO` 0 and 1, `CASL` 1, wght 300..1000** |
| Sometype Mono | 1000 | 580, all equal | yes | n/a | 0.580 | yes |
| Doto | 1000 | 600, all equal | yes | n/a | 0.600 | yes |
| Big Shoulders | 2000 | 316..618, 10 distinct | **no** | none | n/a | **no, and there is no fix** |

VERIFIED (measured).

Two more axis facts worth knowing before you design a responsive readout:

- **`wdth` scales digits proportionally, it does not preserve them.** Instrument Sans digits go
  from 391..666 units at `wdth 100` down to 296..460 at `wdth 75`. Saira goes from 365..682 at
  `wdth 100` to 170..325 at `wdth 50`. Martian Mono goes from 750 units at `wdth 112.5` to 600 at
  `wdth 75`, i.e. 0.75 em to 0.60 em per character. If you animate `font-stretch`, the whole
  readout reflows. VERIFIED (measured).
- **Recursive is width invariant on every axis.** 600 units per digit at `MONO=0`, `MONO=1`,
  `CASL=1` and `wght=800`. That is unusually strong and is the single best argument for it as the
  data face. VERIFIED (measured).

### 1.5 Verified glyph coverage for instrument symbols

An astronomical instrument needs the degree sign, prime (arcminute) and double prime (arcsecond),
minus, plus or minus, and ideally a figure space. Coverage is not uniform.

| Family | `°` U+00B0 | `′` U+2032 | `″` U+2033 | `−` U+2212 | `±` U+00B1 | `→` U+2192 | figure space U+2007 | `☉` U+2609 |
|---|---|---|---|---|---|---|---|---|
| Archivo | yes | yes | yes | yes | yes | yes | **no** | no |
| Saira | yes | yes | yes | yes | yes | yes | **no** | no |
| Instrument Sans | yes | **no** | **no** | yes | **no** | yes | **no** | no |
| Bodoni Moda | yes | **no** | **no** | yes | yes | **no** | yes | no |
| Newsreader | yes | yes | yes | yes | yes | **no** | **no** | no |
| Big Shoulders | yes | yes | yes | yes | yes | yes | yes | no |
| Martian Mono | yes | **no** | **no** | yes | yes | yes | **no** | no |
| Sometype Mono | yes | **no** | **no** | yes | yes | yes | **no** | no |
| Recursive | yes | yes | yes | yes | yes | yes | yes | no |
| Doto | yes | **no** | **no** | **no** | **no** | **no** | **no** | no |

VERIFIED (measured), from each font's best `cmap`.

Consequences:

- **No family in the set has U+2609 SUN.** Draw the subsolar point marker as inline SVG or in the
  WebGL layer. Do not rely on a glyph.
- If you write coordinates as `59° 54′ 44″ N`, then Instrument Sans, Martian Mono, Sometype Mono,
  Bodoni Moda and Doto will fall back for the primes, which in a subsetted offline build means
  tofu. Either pick a face from the yes column for coordinates, or write them as
  `59° 54.74′ N` with the prime supplied by a tiny separate icon, or normalise your formatter to
  use `'` and `"` (ugly, but safe). The clean answer is to make your **coordinate readout use the
  data face**, and pick a data face with primes: Recursive has them, Martian Mono and Sometype
  Mono do not.
- **Figure space U+2007 is missing from most of them.** That kills the classic "pad with figure
  spaces" trick. Section 3 gives a CSS `ch` based alternative that does not depend on a glyph.

### 1.6 Verified vertical metrics

Useful for optically aligning a display title against a mono readout, and for setting
`line-height` so a viewport locked panel does not creep.

| Family | upem | cap height | x height | cap / em | x / em | hhea asc / desc | line gap |
|---|---|---|---|---|---|---|---|
| Archivo | 1000 | 686 | 526 | 0.686 | 0.526 | 878 / -210 | 0 |
| Saira | 1000 | 688 | 510 | 0.688 | 0.510 | 1135 / -439 | 0 |
| Instrument Sans | 1000 | 720 | 510 | 0.720 | 0.510 | 970 / -250 | 0 |
| Bodoni Moda | 2000 | 1500 | 920 | 0.750 | 0.460 | 2250 / -800 | 0 |
| Newsreader | 2000 | 1340 | 852 | 0.670 | 0.426 | 1470 / -530 | 0 |
| Big Shoulders | 2000 | 1600 | 1200 | 0.800 | 0.600 | 1971 / -429 | 0 |
| Martian Mono | 1000 | 800 | 600 | 0.800 | 0.600 | 1000 / -200 | 0 |
| Sometype Mono | 1000 | 650 | 470 | 0.650 | 0.470 | 925 / -275 | 0 |
| Recursive | 1000 | 700 | 526 | 0.700 | 0.526 | 950 / -250 | 0 |
| Doto | 1000 | 700 | 500 | 0.700 | 0.500 | 950 / -250 | 0 |

VERIFIED (measured).

Two practical notes. Saira's `hhea` box is 1135 + 439 = 1574 units tall, i.e. 1.574 em, so a naive
`line-height: 1` clips nothing but leaves a lot of leading; set explicit line heights everywhere.
Bodoni Moda is 2250 + 800 = 3050 units on a 2000 upem, i.e. 1.525 em, and its x height is only
0.46 em, so at a matched `font-size` it will look far smaller than Archivo (0.526 x height).
Optically match on **x height**, not font size: to sit Bodoni Moda next to Archivo at 16px, set
Bodoni Moda to about `16 * 0.526 / 0.460 = 18.3px`.

---

### Pairing A: "Admiralty"

**Bodoni Moda** (display) + **Archivo** (UI) + **Martian Mono** (data)

| Role | Family | Variable | Axes used | Subset size |
|---|---|---|---|---|
| Display | Bodoni Moda | yes | `opsz` pinned 72, `wght` 400..700 | 12,104 B |
| UI | Archivo | yes | `wdth` pinned 100, `wght` 300..700 | 17,456 B |
| Data | Martian Mono | yes | `wdth` pinned 100, `wght` 300..700 | 11,984 B |
| **Total** | | | | **40,655 B (39.7 KB), 40.6 KB base64 after brotli** |

Bodoni Moda is a Didone in the direct lineage of the engraved title cartouches on 18th and 19th
century Admiralty charts and almanac frontispieces, and its `opsz` 6..96 axis means the same file
gives you a hairline-thin 96pt masthead and a still-readable caption. Archivo was drawn for
highly legible small print and grotesque headline work, it carries `tnum`, `zero`, `case` and both
figure styles, and its `wdth` 62..125 axis is the cleanest single-family answer to "the same label
must fit a 4K sidebar and a 390px control strip".

**Watch out for**: Archivo's tabular digit advance changes with weight (556, 573, 667 units at
wght 100, 500, 900). Fix the weight of any live numeral. Bodoni Moda has no prime or double prime.

---

### Pairing B: "Ephemeris"

**Newsreader** (display) + **Instrument Sans** (UI) + **Sometype Mono** (data)

| Role | Family | Variable | Axes used | Subset size |
|---|---|---|---|---|
| Display | Newsreader | yes | `opsz` pinned 72, `wght` 300..700 | 23,844 B |
| UI | Instrument Sans | yes | `wdth` pinned 100, `wght` 400..700 | 22,592 B |
| Data | Sometype Mono | yes | `wght` 400..700 | 8,804 B |
| **Total** | | | | **55,240 B (53.9 KB), 54.0 KB base64 after brotli** |

Newsreader is Production Type's screen-first text serif with a genuine 6..72 optical size axis, so
one file spans an almanac footnote and a masthead, and its lining figures are **already tabular at
1100/2000 units with no feature needed** (measured), which is exactly the behaviour of a printed
ephemeris table. Instrument Sans is a tight, slightly condensed neo-grotesque whose `tnum` advance
is a flat 600/1000 units at wght 400, 550 and 700 (measured), making it the most dimensionally
stable clock face in the whole set, and it ships twelve stylistic sets if you want to tune the
`a`, `g` or `l` away from generic.

**Watch out for**: Instrument Sans lacks prime, double prime and plus or minus. Sometype Mono
lacks primes too. If you show sexagesimal coordinates, this pairing needs a fourth face or an SVG
prime. Also, Instrument Sans is Instrument's sibling to Instrument Serif, which **is** on the
overused list; if that adjacency bothers you, swap in Archivo (17,456 B) with no other change.

---

### Pairing C: "Telemetry"

**Big Shoulders** (display) + **Saira** (UI) + **Recursive at MONO=1** (data)

| Role | Family | Variable | Axes used | Subset size |
|---|---|---|---|---|
| Display | Big Shoulders | yes | `opsz` pinned 72, `wght` 100..900 | 16,032 B |
| UI | Saira | yes | `wdth` pinned 100, `wght` 300..700 | 18,224 B |
| Data | Recursive | yes | `MONO=1 CASL=0 slnt=0 CRSV=0`, `wght` 300..800 | 24,064 B |
| **Total** | | | | **58,320 B (57.0 KB), 57.1 KB base64 after brotli** |
| Optional LED accent | Doto | yes | `ROND=0`, `wght` 300..700 | 2,960 B |

Big Shoulders is a tall, very narrow condensed display face drawn for Chicago public wayfinding,
and it reads as a stencilled panel legend or an instrument bezel rather than as a magazine
headline, which is exactly the mission-control register. Saira gives you a 50..125 width axis plus
`zero` and `tnum` whose advance is a flat 620/1000 at wght 100, 500 and 900 (measured), so
condensed technical labelling and stable numerals come from one file. Recursive at `MONO=1` is a
single file whose every digit is 600/1000 units at every position of every axis, so a value can
change weight, slant or casual-ness mid-animation and never move a pixel horizontally.

**Watch out for**: Big Shoulders has proportional digits and no `tnum`. It is a titling face
only. Recursive's full-Latin subset is the largest in the study (300,188 B with all five axes
kept), so pinning the four axes you do not need is not optional, it is the entire saving:
221,416 B down to 24,064 B.

**Bonus**: if you want the "annunciator panel" note, Doto is a fully monospaced 0.6 em dot grid
that costs 2,960 B and renders a UTC readout as a dot matrix display. Use it for exactly one
element, never for body text, and remember it has zero OpenType features.

---

### 1.7 Recommendation

**Pairing A ("Admiralty") is the strongest fit** for a heliograph specifically, because the
subject is not aerospace telemetry, it is celestial navigation, and the Didone plus grotesque plus
wide-mono combination is the exact typographic register of a chart table. It is also the smallest
at 39.7 KB.

Pairing C is the right choice if the interface leans hard on live scrubbing and readouts, because
Recursive's absolute width invariance removes a whole category of bug. Pairing B is the right
choice if there is a lot of prose (an explanation panel, an about page), because Newsreader is the
only face here that is genuinely comfortable at paragraph length.

---

## 2. Embedding with zero runtime network requests

### 2.1 Two ways to obtain the real woff2, and why one is better

#### Option 1 (recommended): take the upstream variable TTF from the google/fonts repository

```bash
# The filename is the METADATA.pb "filename" field, URL-encoded for the brackets.
curl -s -o "Archivo[wdth,wght].ttf" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf"
curl -s -o "OFL-Archivo.txt" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt"
```

This gives you the untouched, full-axis, full-feature source, which is what you want because you
are going to subset it yourself and you want control over which features survive. It is also
reproducible: pin the commit if you care.

VERIFIED (measured) upstream TTF sizes: Archivo 658,596 B, Recursive 2,379,132 B, Newsreader
451,664 B, Bodoni Moda 162,104 B, Saira 483,700 B, Big Shoulders 320,800 B, Instrument Sans
194,336 B, Martian Mono 148,460 B, Sometype Mono 64,308 B, Doto 456,924 B.

#### Option 2: the css2 API with a modern user agent

The Google Fonts CSS API content-negotiates on `User-Agent`. This is real and I measured it.

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

curl -s -A "$UA" \
  "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400..900&display=swap"
```

VERIFIED (measured), same URL `https://fonts.googleapis.com/css2?family=Archivo:wght@400..700`:

| `User-Agent` sent | `format()` returned |
|---|---|
| curl default (`curl/8.x`) | `format('truetype')` |
| Chrome 126 UA string above | `format('woff2')` |
| `Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)` | `format('woff')` |
| Safari 6 on OS X 10.8 | `format('woff')` |

So: **send a modern Chrome UA or you get a TrueType file.**

The response is split into several `@font-face` blocks by `unicode-range`. The Latin one is the
block whose `unicode-range` starts `U+0000-00FF`. Extract it like this:

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
url=$(curl -s -A "$UA" \
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400..700" \
  | grep -B4 'U+0000-00FF' | grep -o 'https://[^)]*woff2' | tail -1)
curl -s -o archivo-latin.woff2 "$url"
```

**A genuinely useful behaviour of css2**: the axes you *omit* from the query get pinned to their
default, and the served file shrinks accordingly. The axis ranges you *do* request are not
clipped.

VERIFIED (measured), Archivo Latin subset:

| Query | Axes in the served woff2 | Bytes |
|---|---|---|
| `family=Archivo:wdth,wght@62..125,100..900` | `wght` 100..900, `wdth` 62..125 | 90,104 |
| `family=Archivo:wght@400..700` | `wght` 100..900 only, `wdth` gone | **34,928** |

Dropping the width axis alone cut the file by 61 percent. Note that `wght` stayed at 100..900,
i.e. Google pinned but did not clip.

**Why option 1 is still better**: gstatic URLs contain a content hash that rotates, the served
file is already subset in a way you cannot control, features may already be gone (measured: the
Google-served Latin Recursive has lost `zero`, all twelve `ss` sets, `ss20` and `titl`, keeping
only `ccmp dnom frac kern locl mark mkmk numr pnum rvrn`), and you cannot narrow a range. Do your own subsetting from source.

VERIFIED (measured) Google-served Latin variable woff2 sizes, for reference against your own
pipeline output:

| Family | Google Latin woff2 | Your own Latin subset (pyftsubset) |
|---|---|---|
| Doto | 6,048 | 5,572 |
| Sometype Mono | 16,648 | 15,040 |
| Martian Mono | 38,492 | 35,456 |
| Bodoni Moda | 46,260 | 46,688 |
| Instrument Sans | 57,332 | 61,304 |
| Big Shoulders | 58,436 | 57,728 |
| Archivo | 90,104 | 85,328 |
| Saira | 98,912 | 95,408 |
| Newsreader | 132,000 | 130,468 |
| Recursive | 142,400 | 300,188 |

Google's Recursive is much smaller than a faithful full-feature subset because Google threw away
the stylistic sets. Your own subset is under your control.

### 2.2 The subsetting pipeline (fontTools)

Two stages: narrow the variation space with `fonttools varLib.instancer`, then subset characters
and features with `pyftsubset`. `pyftsubset` has **no** `--variations` option, so the instancer
stage is mandatory if you want axis narrowing. VERIFIED (measured) against `pyftsubset --help`.

#### Setup

```bash
python -m venv .fontvenv
.fontvenv/bin/pip install "fonttools[woff]" brotli
```

`brotli` is required for `--flavor=woff2`. Without it `pyftsubset` fails.

#### Stage 1: narrow the variation space

```bash
# Pin an axis:              wdth=100
# Clip an axis to a range:  wght=300:700
# Clip and set a default:   wght=300:400:700
# Drop an axis entirely:    CRSV=drop
python -m fontTools.varLib.instancer -q \
  "Archivo[wdth,wght].ttf" wdth=100 wght=300:700 \
  -o "Archivo-narrowed.ttf"
```

#### Stage 2: subset characters, features and tables

```bash
LATIN_INSTRUMENT="U+0020-007E,U+00A0,U+00B0,U+00B1,U+00B7,U+00D7,\
U+2007,U+2009,U+200A,U+2013,U+2014,U+2018-2019,U+201C-201D,\
U+2022,U+2026,U+2032,U+2033,U+2039,U+203A,U+2190-2193,U+2212"

pyftsubset "Archivo-narrowed.ttf" \
  --output-file="archivo-ui.woff2" \
  --flavor=woff2 \
  --unicodes="$LATIN_INSTRUMENT" \
  --layout-features="ccmp,locl,kern,mark,mkmk,liga,tnum,case,zero,rvrn" \
  --no-hinting \
  --desubroutinize \
  --drop-tables+=DSIG \
  --notdef-outline \
  --recalc-bounds
```

If you need accented Latin (place names, city labels), use Google's own `latin` range instead of
the tight one:

```
U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,
U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD
```

Add `U+0100-02BA,U+1E00-1E9F,U+2C60-2C7F,U+A720-A7FF` (Google's `latin-ext`) if you show
Polish, Czech, Turkish or Vietnamese place names.

#### Option notes, all VERIFIED (source, fontTools docs) unless marked

- `--layout-features` **default** preserves `calt ccmp clig curs dnom frac kern liga locl mark
  mkmk numr rclt rlig rvrn` plus script-required features. `tnum`, `case` and `zero` are **not**
  in the default set, so you must add them explicitly or your tabular figures silently vanish.
  This is the single most common way to break a numeric UI with a subsetter.
- `--name-IDs` **default** preserves nameIDs 0 to 6.
- `--desubroutinize` only affects CFF fonts. All ten families here are glyf/TrueType so it is a
  no-op, harmless to leave in.
- `--with-zopfli` only applies to `--flavor=woff`, not woff2.
- `--harfbuzz-repacker` can help when `GSUB`/`GPOS` overflow; not needed at these sizes.

#### Measured cost of the options

Archivo, tight instrument charset, `wdth=100 wght=300:700`:

| Variation | woff2 bytes |
|---|---|
| `--layout-features="kern,tnum"` | 16,108 |
| `--layout-features="ccmp,locl,kern,mark,mkmk,liga,tnum,case,zero"` | 17,560 |
| default `--layout-features` (no tnum, no case, no zero) | 18,416 |
| `--layout-features="*"` | 21,736 |
| `--name-IDs=''` | 17,372 |
| `--name-IDs='0,1,2,3,4,5,6'` (default) | 17,560 |
| `--name-IDs='*'` | 17,788 |

VERIFIED (measured). Keeping the standard name IDs costs 188 bytes. Keep them; a nameless font is
miserable to debug.

#### Measured pipeline output for all three pairings

Tight instrument charset unless marked "display charset"
(`U+0020,U+0021,U+0026,U+002C-002E,U+0030-0039,U+0041-005A,U+0061-007A,U+00B0,U+2013,U+2019`).

| Font and instancing | woff2 | base64 | base64 + brotli | net cost vs raw woff2 |
|---|---|---|---|---|
| Archivo `wdth=100 wght=300:700` | 17,456 | 23,276 | 17,573 | +117 B (+0.7%) |
| Instrument Sans `wdth=100` | 22,592 | 30,124 | 22,732 | +140 B (+0.6%) |
| Saira `wdth=100 wght=300:700` | 18,224 | 24,300 | 18,340 | +116 B (+0.6%) |
| Martian Mono `wdth=100 wght=300:700` | 11,984 | 15,980 | 12,083 | +99 B (+0.8%) |
| Recursive `MONO=1 CASL=0 slnt=0 CRSV=0 wght=300:800` | 24,064 | 32,088 | 24,207 | +143 B (+0.6%) |
| Sometype Mono `wght=400:700` | 8,804 | 11,740 | 8,897 | +93 B (+1.1%) |
| Newsreader `opsz=48 wght=300:700` | 35,204 | 46,940 | 35,362 | +158 B (+0.4%) |
| Bodoni Moda display charset `opsz=72 wght=400:700` | 12,104 | 16,140 | 12,207 | +103 B (+0.9%) |
| Big Shoulders display charset `opsz=72` | 16,032 | 21,376 | 16,139 | +107 B (+0.7%) |
| Newsreader display charset `opsz=72 wght=300:700` | 23,844 | 31,792 | 23,972 | +128 B (+0.5%) |
| Doto display charset `ROND=0` | 2,456 | 3,276 | 2,530 | +74 B (+3.0%) |

VERIFIED (measured).

**Impact of instancing alone** (same charset, before and after pinning `wdth`):

| Family | all axes kept | after pinning `wdth` and clipping `wght` | saving |
|---|---|---|---|
| Archivo | 49,708 | 17,456 | 65% |
| Saira | 59,128 | 18,224 | 69% |
| Instrument Sans | 47,184 | 22,592 | 52% |
| Martian Mono | 22,128 | 11,984 | 46% |
| Recursive | 221,416 | 24,064 | 89% |
| Newsreader | 86,592 | 35,204 | 59% |

VERIFIED (measured). Pinning the width axis is the single highest-leverage thing in the pipeline.
Decide up front whether you actually need runtime width variation; if you only use two widths,
ship two pinned instances, which will still be smaller than one variable file with the axis.

### 2.3 Pure Node alternative

`subset-font` wraps `harfbuzzjs` (a WASM build of HarfBuzz `hb-subset`) plus `fontverter` for
woff2 in and out. Verified metadata from the npm registry:

| Package | Version | Licence | Notes |
|---|---|---|---|
| `subset-font` | 2.5.0 | BSD-3-Clause | wrapper, deps `harfbuzzjs`, `fontverter`, `lodash`, `p-limit` |
| `harfbuzzjs` | 1.6.0 | MIT | zero dependencies, raw WASM bindings |
| `fontkit` | 2.0.4 | MIT | font parsing and layout, **not** a subsetter with woff2 output |
| `wawoff2` | 2.0.1 | MIT | TTF to woff2 only |

VERIFIED (source), npm registry `latest` manifests.

Working script, VERIFIED (measured, this exact code ran):

```js
// scripts/build-fonts.mjs
import subsetFont from 'subset-font';
import fs from 'node:fs';

// Written as escapes on purpose: several of these are invisible spaces,
// and a literal would be impossible to review or diff.
const EXTRA = [
  0x00a0, 0x00b0, 0x00b1, 0x00b7, 0x00d7,        // nbsp, degree, plusminus, middot, multiply
  0x2007, 0x2009, 0x200a,                        // figure space, thin space, hair space
  0x2013, 0x2014,                                // dashes
  0x2018, 0x2019, 0x201c, 0x201d,                // quotes
  0x2022, 0x2026,                                // bullet, ellipsis
  0x2032, 0x2033,                                // prime, double prime (arcmin, arcsec)
  0x2039, 0x203a,                                // single guillemets
  0x2190, 0x2191, 0x2192, 0x2193,                // arrows
  0x2212,                                        // minus
];
const TEXT =
  Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)).join('') +
  EXTRA.map((c) => String.fromCodePoint(c)).join('');

const jobs = [
  ['archivo-ui',   'Archivo[wdth,wght].ttf',  { wdth: 100, wght: { min: 300, max: 700 } }],
  ['martian-data', 'MartianMono[wdth,wght].ttf', { wdth: 100, wght: { min: 300, max: 700 } }],
  ['bodoni-disp',  'BodoniModa[opsz,wght].ttf',  { opsz: 72,  wght: { min: 400, max: 700 } }],
];

for (const [out, file, variationAxes] of jobs) {
  const buf = await subsetFont(fs.readFileSync(`vendor/fonts/${file}`), TEXT, {
    targetFormat: 'woff2',
    variationAxes,
    preserveNameIds: [0, 1, 2, 3, 4, 5, 6],
  });
  fs.writeFileSync(`src/assets/fonts/${out}.woff2`, buf);
  console.log(out, buf.length);
}
```

`variationAxes` accepts a number to pin an axis, or `{ min, max }` (optionally with `default`) to
clip it. Axes you omit are kept as they are, which is the opposite of the css2 API behaviour, so
list every axis you want gone.

#### Measured fontTools vs harfbuzz, identical charset and identical instancing

| Family | pyftsubset (features pruned) | subset-font / hb-subset (all features) | delta |
|---|---|---|---|
| Archivo | 17,456 | 21,788 | +24.8% |
| Instrument Sans | 22,592 | 29,360 | +30.0% |
| Martian Mono | 11,984 | 15,048 | +25.6% |
| Saira | 18,224 | 26,384 | +44.8% |
| Recursive `MONO=1` | 24,064 | 46,976 | +95.2% |

VERIFIED (measured). The gap is **entirely feature pruning**, not compression quality. hb-subset
via `subset-font` keeps every `GSUB` feature and performs layout closure, which drags in extra
glyphs (Archivo: 224 glyphs kept versus 157 with pyftsubset). `subset-font` exposes
`noLayoutClosure` but not a feature allowlist, so you cannot close the gap from Node with this
wrapper. Recursive is the pathological case because it has 30 features including `ss01` to `ss20`.

**Recommendation**: use `pyftsubset` in a one-time, committed build step. The fonts do not change
between builds, so this does not need to be part of the Vite pipeline at all. Commit the
subsetted `.woff2` files to the repo alongside the `OFL.txt`, and regenerate them with a
documented `npm run fonts` script (which shells out to Python) only when the type system changes.
That keeps the Node dependency tree clean and gives you the smaller files. If you refuse a Python
dependency, take the 25 to 45 percent penalty with `subset-font`; at these absolute sizes it is
9 KB, not 90 KB.

### 2.4 Inlining as base64, and whether it is worth it

#### The mechanics

```css
@font-face {
  font-family: 'Archivo UI';
  src: url(data:font/woff2;base64,d09GMgABAAAAA...) format('woff2');
  font-weight: 300 700;      /* declare the surviving range */
  font-style: normal;
  font-display: block;       /* see the caveat below */
  unicode-range: U+0000-00FF, U+2000-206F, U+2212;
}
```

Notes, all VERIFIED (measured in Chromium, Firefox and WebKit):

- `format('woff2')` works for variable fonts in all three engines. You do **not** need
  `format('woff2-variations')`, which MDN itself notes is not universally implemented.
  https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_fonts/Variable_fonts_guide
- The MIME type `font/woff2` in the data URI is accepted by all three.
- Declare the weight range on `@font-face` and then drive it with the standard `font-weight`
  property, not `font-variation-settings`. MDN: "wherever possible, the appropriate property
  should be used, with the lower-level syntax of `font-variation-settings` only being used to set
  values or axes not available otherwise", and "If you have set values using
  `font-variation-settings` and want to change one of those values, you must redeclare all of
  them." For `opsz`, use `font-optical-sizing: auto` (or `none` if you want a fixed optical size).
  For custom axes such as Recursive's `MONO` and `CASL`, `font-variation-settings` is the only
  option, so route it through a custom property so you can change one axis at a time:
  ```css
  .data { --mono: 1; --casl: 0; font-variation-settings: 'MONO' var(--mono), 'CASL' var(--casl); }
  ```

#### The 33 percent question, answered with measurements

Base64 inflates by exactly 4/3. The interesting question is what survives transport compression,
because woff2 payload is already brotli-compressed and therefore base64 of it is nearly
incompressible.

| Font | raw woff2 | base64 (+33.3%) | base64 wrapped in CSS, brotli q11 | base64 wrapped in CSS, gzip -9 | net over the wire vs raw woff2 |
|---|---|---|---|---|---|
| Archivo UI | 17,456 | 23,276 | 17,573 | 17,714 | **+117 B (+0.67%)** |
| Instrument Sans | 22,592 | 30,124 | 22,732 | 22,882 | +140 B (+0.62%) |
| Martian Mono | 11,984 | 15,980 | 12,083 | 12,172 | +99 B (+0.83%) |
| Recursive mono | 24,064 | 32,088 | 24,207 | 24,370 | +143 B (+0.59%) |
| Bodoni display | 12,104 | 16,140 | 12,207 | 12,296 | +103 B (+0.85%) |
| Doto | 2,456 | 3,276 | 2,530 | 2,570 | +74 B (+3.01%) |

Whole pairings:

| Pairing | raw woff2 | base64 | base64 + brotli |
|---|---|---|---|
| A Admiralty | 40.6 KB | 54.1 KB | **40.6 KB** |
| B Ephemeris | 53.9 KB | 71.9 KB | **54.0 KB** |
| C Telemetry | 57.0 KB | 75.9 KB | **57.1 KB** |

VERIFIED (measured).

**Verdict: yes, inline as base64 for this app.** The real cost is under one percent, not 33
percent, as long as the CSS is served with brotli or gzip (or, for a truly local build, as long as
you do not care because there is no network at all). What you buy is:

1. **Zero network requests at runtime, guaranteed.** No `<link>`, no `url()` fetch, no service
   worker cache miss, no `file://` protocol weirdness. This is the actual requirement.
2. **No FOUT and no FOIT race.** The font bytes are present the moment the CSS is parsed.
3. **The whole app can be one HTML file** if you want it to be, which for an offline instrument is
   a genuinely nice property.

The costs you accept:

1. The CSS becomes render-blocking and larger. At 40 to 57 KB compressed for the whole type
   system, this is negligible.
2. You cannot `<link rel=preload>` the font separately, and you cannot cache fonts independently
   of the CSS. Irrelevant for a single-page offline instrument, relevant for a content site.
3. `font-display` becomes almost meaningless because there is no download. Use
   `font-display: block` anyway so that if anything does go wrong you get a blank rather than a
   flash of the wrong metrics.

#### Vite wiring

```js
// vite.config.ts
export default defineConfig({
  build: {
    // 4 MB, i.e. always inline. Vite inlines assets under this as base64 data URIs.
    assetsInlineLimit: 4 * 1024 * 1024,
    cssCodeSplit: false,
  },
});
```

Then simply `src: url('./assets/fonts/archivo-ui.woff2') format('woff2')` in a plain CSS file and
Vite will turn it into a data URI at build time. This keeps the source readable and avoids a
230 KB base64 blob in your editor. (UNVERIFIED: I did not run a Vite build; the
`assetsInlineLimit` semantics are from Vite's documented behaviour.)

If you would rather not touch `assetsInlineLimit` globally (it also affects images), generate the
`@font-face` CSS in the build step instead, which is what I did for the measurements:

```py
import base64
faces = []
for fam, path in FONTS.items():
    b = base64.b64encode(open(path, 'rb').read()).decode()
    faces.append(
        f"@font-face{{font-family:'{fam}';font-display:block;"
        f"src:url(data:font/woff2;base64,{b}) format('woff2');"
        f"font-weight:{RANGES[fam]};font-style:normal}}"
    )
open('src/styles/fonts.generated.css', 'w').write('\n'.join(faces))
```

The generated file for all ten study fonts was 226,978 bytes; for one pairing it is about 55 to
78 KB of text.

### 2.5 A pipeline gotcha that will cost you an afternoon

**`document.fonts.ready` does not wait for fonts nothing has requested yet.**

VERIFIED (measured, and I hit it myself). I built a page with ten base64 `@font-face` rules, waited
for `await document.fonts.ready`, then measured text widths in off-screen spans. **Chromium and
WebKit returned fallback metrics for all ten families. Firefox returned correct metrics.** The
fonts were fine; nothing in the initial document used those families, so Blink and WebKit had not
requested them, so `document.fonts.ready` resolved immediately with nothing loaded.

This matters for a heliograph because you will almost certainly measure text (to size a panel, to
lay out a timezone label, or to draw into a 2D canvas overlay). The fix:

```js
const FACES = ['Archivo UI', 'Martian Data', 'Bodoni Display'];

export async function ensureFonts() {
  await Promise.all(
    FACES.flatMap((f) => [
      document.fonts.load(`400 16px "${f}"`, '0123456789:°′″'),
      document.fonts.load(`700 16px "${f}"`, '0123456789:°′″'),
    ]),
  );
  await document.fonts.ready;
}
```

Call `ensureFonts()` before your first layout measurement or first canvas `measureText`. Load each
weight you will actually use; `document.fonts.load` resolves per face descriptor, not per family.

---

## 3. Numerals: making a ticking clock hold still

### 3.1 The property and the feature tag

```css
.readout {
  font-variant-numeric: tabular-nums;
}
```

`font-variant-numeric: tabular-nums` maps to the OpenType `tnum` feature. Spec text: "tabular-nums
activating the set of figures where numbers are all of the same size, allowing them to be easily
aligned like in tables. It corresponds to the OpenType values `tnum`." It is Baseline widely
available since January 2020, is inherited, and its animation type is discrete.
https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric

Full value mapping from the same page:

| CSS value | OpenType tag |
|---|---|
| `lining-nums` | `lnum` |
| `oldstyle-nums` | `onum` |
| `proportional-nums` | `pnum` |
| `tabular-nums` | `tnum` |
| `diagonal-fractions` | `frac` |
| `stacked-fractions` | `afrc` |
| `ordinal` | `ordn` |
| `slashed-zero` | `zero` |

**Use `font-variant-numeric`, not `font-feature-settings`.** Both work (measured, identical
results in all three engines), but `font-feature-settings` is all-or-nothing: setting it anywhere
resets every feature you set elsewhere, exactly like `font-variation-settings`. `font-variant-*`
composes properly through the cascade.

The one thing worth adding is the slashed zero, where the family has it:

```css
.readout { font-variant-numeric: tabular-nums slashed-zero; }
```

`zero` is present in **Archivo, Saira and Recursive** and absent from the rest.

### 3.2 Which candidates actually ship tnum, verified in the browser

I rendered `0000000000`, `1111111111`, `8888888888` and `1234567890` at 64px in each subsetted
font in Chromium, Firefox and WebKit, and compared bounding widths.

| Family | proportional digits equal width? | with `tabular-nums`? | with `font-feature-settings:"tnum"`? |
|---|---|---|---|
| Instrument Sans | no | **yes** | yes |
| Archivo | no | **yes** | yes |
| Saira | no | **yes** | yes |
| Bodoni Moda | no | **yes** | yes |
| Newsreader | **yes already** | yes | yes |
| Martian Mono | yes (mono) | yes | yes |
| Recursive `MONO=1` | yes (mono) | yes | yes |
| Sometype Mono | yes (mono) | yes | yes |
| Doto | yes (mono) | yes | yes |
| **Big Shoulders** | **no** | **NO** | **NO** |

VERIFIED (measured), identical verdicts in all three engines.

Big Shoulders cannot be made tabular. It has no `tnum` and no `.tf` glyphs. Titles only.

### 3.3 The jitter source nobody warns you about: separators and weight

Even with `tabular-nums` on, a clock string `12:34:56` **still changes width when you change the
weight**, because the colon is a proportional glyph and `tnum` does not touch it.

Measured width of `12:34:56` at `font-size: 64px`, `font-variant-numeric: tabular-nums`:

| Family | at `font-weight: 400` | at `font-weight: 700` | shift | shift as % |
|---|---|---|---|---|
| Martian Mono | 358.41 px | 358.41 px | **0.00 px** | 0.0% |
| Recursive `MONO=1` | 307.20 px | 307.20 px | **0.00 px** | 0.0% |
| Sometype Mono | 296.97 px | 296.97 px | **0.00 px** | 0.0% |
| Doto | 307.20 px | 307.20 px | **0.00 px** | 0.0% |
| Instrument Sans | 263.05 px | 266.89 px | +3.84 px | +1.5% |
| Saira | 266.63 px | 276.36 px | +9.73 px | +3.7% |
| Archivo | 256.00 px | 272.52 px | +16.52 px | +6.4% |
| Newsreader | 254.73 px | 282.77 px | +28.03 px | +11.0% |
| Bodoni Moda | 258.30 px | 288.39 px | +30.09 px | +11.7% |
| Big Shoulders | 170.67 px | 207.17 px | +36.50 px | +21.4% |

VERIFIED (measured, Chromium; Firefox within 0.05 px, WebKit within 0.05 px except Bodoni Moda and
Big Shoulders where WebKit differs by about 3 percent).

Instrument Sans's +3.84 px is instructive: its tabular digits are a flat 600/1000 units at every
weight (section 1.4), so all 3.84 px comes from the two colons, i.e. 1.92 px each at 64px.

**Rules that follow:**

1. **Never animate `font-weight` on a live numeric readout.** Animate colour, opacity or a
   background, never metrics.
2. **Prefer a monospace for the primary readout.** Not for the retro look, but because the
   separators are fixed pitch too, so the string is genuinely immovable.
3. If the readout must be in a proportional face, either put each separator in a fixed-width span,
   or accept the shift and make sure the readout is not centred (a centred readout that grows moves
   both ends; a left-aligned one moves only the right edge).

### 3.4 The fallback: fixed-width digit slots

Because U+2007 FIGURE SPACE is missing from most of these families (section 1.5), the classic
"pad with figure spaces" trick is unavailable. Use `ch` units instead. In a font with tabular
figures, `1ch` is the advance of `0`, which is exactly a digit slot.

```css
.slot {
  display: inline-block;
  inline-size: 1ch;                 /* one digit slot */
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-feature-settings: normal;    /* do not let anything else clobber it */
}
.slot--sep { inline-size: 0.45ch; } /* colon, measured per family */
```

Measured digit advance in `em` for each family, which is what `1ch` will equal when tabular
figures are active:

| Family | digit advance (em) |
|---|---|
| Newsreader | 0.550 |
| Bodoni Moda (tnum) | 0.580 |
| Sometype Mono | 0.580 |
| Archivo (tnum, at wght 400) | 0.579 |
| Instrument Sans (tnum) | 0.600 |
| Recursive | 0.600 |
| Doto | 0.600 |
| Saira (tnum) | 0.620 |
| Martian Mono | 0.750 |

VERIFIED (measured). Note Martian Mono is very wide: an eight-character clock is 6.0 em, so a
`clamp()`-based type scale needs to account for that (`12:34:56` at 64px is 358 px wide, versus
263 px in Instrument Sans).

The belt-and-braces version, which survives any font substitution:

```css
.readout {
  font-variant-numeric: tabular-nums;
  /* reserve the exact width of the longest string this element can hold */
  min-inline-size: 8ch;
  font-kerning: none;        /* kerning between digits is another jitter source */
  letter-spacing: 0;         /* never use letter-spacing on a live readout */
  font-feature-settings: 'tnum' 1;
}
```

`font-kerning: none` matters: Archivo, Saira, Bodoni Moda and Newsreader all have `kern`, and a
kern pair between a digit and a colon will move things even with tabular figures.

### 3.5 Tasteful digit change animation

The good version is a **short vertical roll of only the digits that changed**, plus an even shorter
luminance flash. The key insight is that in a clock, the seconds digit changes 60 times more often
than the minutes digit, so animating the whole string is both wasteful and visually noisy.

```html
<span class="readout" aria-label="14 hours 07 minutes 32 seconds UTC">
  <span class="slot" data-d="1">1</span><span class="slot" data-d="4">4</span>
  <span class="slot slot--sep">:</span>
  <span class="slot" data-d="0">0</span><span class="slot" data-d="7">7</span>
  <span class="slot slot--sep">:</span>
  <span class="slot" data-d="3">3</span><span class="slot" data-d="2">2</span>
</span>
```

```css
@property --roll { syntax: '<length>'; inherits: false; initial-value: 0px; }

.slot {
  display: inline-block;
  inline-size: 1ch;
  block-size: 1lh;
  overflow: hidden;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.slot > i {
  display: block;
  font-style: normal;
  transform: translateY(var(--roll));
  transition: transform 140ms cubic-bezier(0.2, 0, 0.38, 0.9);
}
.slot[data-changed] {
  animation: tick-flash 220ms cubic-bezier(0, 0, 0.38, 0.9);
}
@keyframes tick-flash {
  0%   { color: var(--text-0); }
  100% { color: var(--text-1); }
}
```

Update only the slots whose value actually changed:

```js
function paint(el, str) {
  const slots = el.querySelectorAll('.slot[data-d]');
  [...str].filter((c) => c >= '0' && c <= '9').forEach((c, i) => {
    const s = slots[i];
    if (s.dataset.d === c) return;
    s.dataset.d = c;
    s.firstElementChild.textContent = c;
    s.setAttribute('data-changed', '');
    s.addEventListener('animationend', () => s.removeAttribute('data-changed'), { once: true });
  });
}
```

`@property` is what makes a custom property interpolable at all: "Registration tells the browser
the property type, so it can interpolate values smoothly during animations and transitions."
Baseline since July 2024.
https://developer.mozilla.org/en-US/docs/Web/CSS/@property

Timings for this specific animation (see section 5 for the general system):

| Element | Duration | Easing | Rationale |
|---|---|---|---|
| Digit roll | 120 to 160 ms | `cubic-bezier(0.2, 0, 0.38, 0.9)` (Carbon standard productive) | Must finish well inside a 1 s tick or it reads as lag |
| Luminance flash | 200 to 240 ms | `cubic-bezier(0, 0, 0.38, 0.9)` (Carbon entrance productive) | Slightly longer than the roll so the eye catches it |
| Seconds digit | **no animation at all above 1x speed** | | At 10x scrub the seconds are meaningless; freeze or hide them |

### 3.6 What NOT to do with numerals

- **Do not use a slot-machine / odometer roll through intermediate digits.** Rolling 7 to 8 by
  passing through nothing is fine; rolling 2 to 9 by scrolling through 3,4,5,6,7,8 is a casino,
  not an instrument. It also costs a compositor layer per digit.
- **Do not animate the whole readout when one digit changes.** It draws the eye to the wrong
  place and, at one second intervals, it never stops moving.
- **Do not animate `font-weight`, `font-stretch`, `letter-spacing`, `font-size` or
  `font-variation-settings` on a live number.** Every one of those changes metrics; see the +3.84
  to +36.50 px table above.
- **Do not use `text-shadow` glow on a ticking readout.** It repaints the text layer every frame
  and, on a dark ground, the halo makes small digits mushy.
- **Do not cross-fade the old and new digit** (both visible at once). For one or two frames you
  render an illegible superposition, which is exactly what a precision instrument must never do.
- **Do not let a spinner, shimmer or pulse sit on the clock while it is "live".** The clock being
  live is already communicated by it ticking.
- **Do not `transition: all`.** On a readout this will animate `color` changes you intended to be
  instant and will silently pick up `width` when the content changes.
- **Do not forget `aria-live`.** A readout that ticks every second with `aria-live="polite"` will
  make a screen reader unusable. Put the live region on the *value the user is scrubbing to*, use
  `aria-live="off"` on the clock itself, and expose the current time via `aria-label` on a
  container that you update at most once per user interaction.

---

## 4. Dark UI craft over a busy moving map

### 4.1 The contrast problem, quantified

Contrast ratio per WCAG 2.2: `(L1 + 0.05) / (L2 + 0.05)` where L is relative luminance
`0.2126 R + 0.7152 G + 0.0722 B` on linearised channels
(`C/12.92` if `C <= 0.04045`, else `((C + 0.055)/1.055)^2.4`).
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

Targets:

- **SC 1.4.3 Contrast (Minimum), Level AA**: 4.5:1 for normal text, 3:1 for large text, where
  large means 18pt (about 24px) or 14pt bold (about 18.5px).
- **SC 1.4.11 Non-text Contrast, Level AA**: 3:1 for "the visual information needed to identify
  user interface components and states" and for "graphical objects" required to understand the
  content. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Decorative hairlines and pure ornament have no contrast requirement. A slider *track boundary*
  does; a panel's edge highlight does not.

Now the actual problem. Here is what happens if you put light text directly on the map.

| Map pixel | hex | relative luminance | contrast with `#E4ECF5` text |
|---|---|---|---|
| Noon land | `#F2D8A8` | 0.7082 | **1.16:1** |
| Noon ocean | `#6FA8D8` | 0.3634 | **2.13:1** |
| Ice cap | `#FFFFFF` | 1.0000 | **1.19:1** |
| Terminator glow | `#F09A4A` | 0.4213 | **1.87:1** |
| City lights glow | `#FFE9B0` | 0.8267 | **1.00:1** |

VERIFIED (measured, computed from the WCAG formula).

Text on the day side of a heliograph is not "a bit low contrast", it is invisible. A scrim is not
a stylistic choice here, it is load-bearing.

### 4.2 How much scrim you actually need

Minimum alpha of a `#04070C` scrim, composited in gamma space as CSS does, for `#E4ECF5` text to
clear each threshold:

| Map pixel underneath | alpha for 3:1 | alpha for 4.5:1 | alpha for 7:1 |
|---|---|---|---|
| Noon land `#F2D8A8` | 0.395 | **0.529** | 0.663 |
| Noon ocean `#6FA8D8` | 0.175 | 0.358 | 0.544 |
| Ice cap `#FFFFFF` | 0.482 | **0.599** | 0.714 |
| Terminator `#F09A4A` | 0.228 | 0.398 | 0.570 |
| City glow `#FFE9B0` | 0.436 | 0.560 | 0.689 |

VERIFIED (measured).

**Design number: a scrim of `rgba(4, 7, 12, 0.62)` guarantees AA (4.5:1) for `#E4ECF5` text over
any map pixel, up to and including pure white ice.** Round to 0.62 for headroom above the 0.599
worst case. If you want AAA, you need 0.72, at which point you have essentially an opaque panel
and should stop pretending it is a scrim.

### 4.3 Scrim gradient versus backdrop-filter, with measurements

#### What backdrop-filter costs, per the spec

The Filter Effects 2 spec is explicit about the work involved. The Backdrop Root Image is produced
by: "Start at the Backdrop Root element nearest ancestor of E. Paint all content in painting order
between and including the ancestor Backdrop Root element and element E. Flatten the painted
content into a 2D screen-space buffer." Then rendering an element with `backdrop-filter` requires
copying that image into a temporary buffer, applying the filter, applying inverse transforms,
clipping, drawing the element into it, and compositing.
https://drafts.csswg.org/filter-effects-2/

Over an animating WebGL canvas, the backdrop changes every frame, so **all of that happens every
frame**. Chromium's own Intent to Ship states: "The backdrop-filter feature is computationally
intensive, as are filters in general, so it may impact the performance of sites that use it."
https://groups.google.com/a/chromium.org/g/blink-dev/c/GRl1_Qy97jM
web.dev is blunter: "Caution: backdrop-filter may harm performance. Test it before deploying."
https://web.dev/articles/backdrop-filter

#### What backdrop-filter costs, measured over a real WebGL2 canvas

Setup: full-viewport WebGL2 canvas at a 3174 x 1356 backing store (dpr 2), a fractal-noise
fragment shader redrawn every frame, panels overlaid in the DOM. Frame intervals sampled over
2.5 s per condition. At light shader load everything is vsync-locked at 13.89 ms with zero drops
and the measurement cannot discriminate, so I raised the shader's octave count until the GPU was
saturated and the composite cost became visible.

| Condition | mean frame ms, light load (7, 16, 26 octaves) | mean frame ms, saturated (36 octaves) | delta vs baseline when saturated |
|---|---|---|---|
| Baseline, canvas only | 13.89 | 17.80 | 0.00 |
| Flat translucent panel 420 x 520 | 13.89 | 17.07 | -0.73 (noise) |
| Gradient scrim panel 420 x 520 | 13.89 | 16.81 | -0.99 (noise) |
| `backdrop-filter: blur(12px)` panel 420 x 520 | 13.89 | 17.31 | -0.49 (noise) |
| `backdrop-filter: blur(24px)` panel 420 x 520 | 13.89 | 17.54 | -0.26 (noise) |
| `backdrop-filter: blur(48px)` panel 420 x 520 | 13.89 | 17.73 | -0.07 (noise) |
| **`backdrop-filter: blur(24px)` on three 420 x 520 panels** | 13.89 | 22.12 | **+4.32 ms** |
| **`backdrop-filter: blur(24px)` FULLSCREEN** | 13.89 | 21.60 | **+3.80 ms** |
| **`backdrop-filter: blur(48px)` FULLSCREEN** | 13.89 | 20.96 | **+3.16 ms** |
| SVG feTurbulence grain overlay, fullscreen | 13.89 | 18.10 | +0.30 ms |
| PNG noise tile overlay, fullscreen | 13.89 | 19.27 | +1.47 ms |

VERIFIED (measured).

The conclusions are clean and slightly counterintuitive:

1. **Area is what costs, radius is essentially free.** `blur(48px)` was not measurably more
   expensive than `blur(24px)` at the same area, and fullscreen `blur(48px)` was actually *cheaper*
   than fullscreen `blur(24px)`, which is consistent with a downsample-then-blur implementation
   where a larger radius means a smaller intermediate. Do not sacrifice the look for a smaller
   radius; sacrifice the area.
2. **One reasonably sized blurred panel over an animating WebGL canvas is free** on modern
   hardware. Not measurably different from a plain translucent div.
3. **Three of them, or one full-screen one, costs about 3 to 4 ms per frame**, which is a quarter
   of a 16.7 ms budget. That is the line.
4. This was measured on an Intel Arc 140T. Scale the absolute numbers up for a mid-range phone.
   The *ratios* should hold. (UNVERIFIED: I did not test mobile hardware.)

#### The decision

**Use a scrim gradient as the primary technique, and backdrop-filter as a single, bounded accent.**

Reasons beyond performance:

- A scrim is deterministic. You can compute exactly what contrast ratio it produces (section 4.2).
  A blur is not: blurring a bright region produces a bright region, so `backdrop-filter: blur()`
  **on its own does nothing at all for contrast**. It only helps because you also put a
  semi-transparent background colour on the element, which is the scrim doing the work.
- A blur reads as "frosted glass phone OS", which is a different genre from "scientific
  instrument". A hard-edged, weighted scrim reads as a chart overlay.
- `backdrop-filter` creates a backdrop root and a stacking context, and any ancestor with
  `opacity < 1`, `filter`, `mask`, `clip-path`, `mix-blend-mode` or `will-change` on those
  silently truncates the backdrop it can see. Over a canvas that you might want to fade in on
  load, this is a real footgun.
  https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- If you do use it, remember: "to create a transparent element allowing the full filtered backdrop
  image to be seen, use `background-color: transparent`", and the effect is invisible unless some
  part of the element is semi-transparent.

Recommended pattern:

```css
/* Primary technique: a directional scrim behind the control rail, no blur. */
.rail::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to top,
    rgb(4 7 12 / 0.92) 0%,
    rgb(4 7 12 / 0.86) 38%,     /* >= 0.62 everywhere text sits */
    rgb(4 7 12 / 0.42) 72%,
    rgb(4 7 12 / 0) 100%
  );
}

/* Accent, used exactly once, on the one floating readout card. */
@supports (backdrop-filter: blur(1px)) {
  .card {
    background-color: rgb(6 10 16 / 0.66);   /* still >= 0.62, blur is decoration */
    backdrop-filter: blur(20px) saturate(115%);
  }
}
@supports not (backdrop-filter: blur(1px)) {
  .card { background-color: rgb(6 10 16 / 0.86); }
}
```

Note the scrim stops at 0.86 rather than 0.92 in the middle: the top of the gradient can be
lighter because no text sits there. Keep alpha at or above **0.62 anywhere a glyph lands**.

**Never animate the blur radius.** A blur radius transition re-runs the entire backdrop pipeline
every frame at a changing kernel size. Animate the background alpha or the element's opacity
instead, both of which are compositor-friendly.

### 4.4 A concrete palette with verified ratios

| Token | Hex | Relative luminance | Contrast vs panel `#0C141F` | Contrast vs void `#04070C` |
|---|---|---|---|---|
| `--void` deep night sea | `#04070C` | 0.0020 | 1.09:1 | 1.00:1 |
| `--ink` page ground | `#070C13` | 0.0036 | 1.06:1 | 1.03:1 |
| `--panel` chrome fill | `#0C141F` | 0.0068 | 1.00:1 | 1.09:1 |
| `--panel-2` raised | `#121C29` | 0.0112 | 1.08:1 | 1.18:1 |
| `--hairline` | `#243040` | 0.0286 | 1.38:1 | 1.51:1 |
| `--text-3` faint label | `#6E8098` | 0.2102 | **4.58:1** AA | 5.00:1 |
| `--text-2` secondary | `#9DB0C6` | 0.4230 | **8.33:1** AAA | 9.09:1 |
| `--text-1` primary | `#E4ECF5` | 0.8308 | **15.51:1** AAA | 16.92:1 |
| `--text-0` readout | `#F7FAFD` | 0.9524 | **17.66:1** AAA | 19.26:1 |
| `--amber` sun accent | `#F5B851` | 0.5429 | **10.44:1** AAA | 11.39:1 |
| `--amber-dim` | `#B8853A` | 0.2727 | 5.68:1 AA | 6.20:1 |
| `--ice` civil twilight | `#8ED3E8` | 0.5817 | **11.13:1** AAA | 12.14:1 |
| `--ice-dim` | `#5EA3BC` | 0.3220 | 6.55:1 AA | 7.15:1 |
| `--alert` chart red | `#FF7A66` | 0.3614 | 7.25:1 AAA | 7.90:1 |

VERIFIED (measured).

`--text-3` at 4.58:1 is deliberately just above the AA line, so it is the floor. Do not go dimmer
for anything that is actual text; use it for the faintest legends and nothing else.

### 4.5 Panel edges: hairline, glow, or nothing

Measured contrast of a white overlay hairline against the panel it borders:

| Hairline | resulting colour | vs `--panel` | vs `--ink` |
|---|---|---|---|
| `rgb(255 255 255 / 0.04)` | `#161D28` | 1.09:1 | 1.16:1 |
| `rgb(255 255 255 / 0.06)` | `#1B222C` | 1.16:1 | 1.22:1 |
| `rgb(255 255 255 / 0.08)` | `#1F2731` | 1.23:1 | 1.30:1 |
| `rgb(255 255 255 / 0.10)` | `#242C35` | 1.31:1 | 1.39:1 |
| `rgb(255 255 255 / 0.14)` | `#2E353E` | 1.49:1 | 1.58:1 |
| `rgb(255 255 255 / 0.20)` | `#3D434C` | 1.85:1 | 1.97:1 |
| `rgb(255 255 255 / 0.28)` | `#50565E` | 2.50:1 | 2.65:1 |

VERIFIED (measured).

**The recommendation: an asymmetric hairline, not a uniform border, and no glow.**

An instrument panel is a machined plate sitting in front of something. Real machined edges catch
light on one side and shadow on the other. A uniform 1px border on all four sides reads as a
web card; a 1px top highlight plus a 1px bottom shadow reads as a physical bezel.

```css
.panel {
  background: rgb(12 20 31 / 0.88);
  border-radius: 3px;                          /* small. Instruments are not pills. */
  box-shadow:
    inset 0 1px 0 0 rgb(255 255 255 / 0.07),   /* top light catch */
    inset 0 -1px 0 0 rgb(0 0 0 / 0.55),        /* bottom shade */
    inset 1px 0 0 0 rgb(255 255 255 / 0.03),   /* barely-there left */
    0 18px 44px -12px rgb(0 0 0 / 0.72);       /* the panel floats over the map */
}
```

Why `0.07` and not `0.14`: at 1.16:1 the edge is present but never draws attention, which is what
you want for something that appears on every panel. Reserve anything above `0.14` (1.49:1) for the
**focused** panel, which gives you a free focus affordance.

Where a border does carry information (a slider track, a toggle outline, a selected timezone
band), it must clear 3:1 per SC 1.4.11. From the table above, no white-alpha value below 0.28 gets
there against the panel. So **do not build informational borders out of low-alpha white.** Use a
real colour: `--text-3` at `#6E8098` gives 4.58:1, `--amber-dim` gives 5.68:1.

**On glow.** Do not put a `box-shadow` glow around panels. Three reasons: it is the single
strongest "AI dark mode" tell; it costs a real blur on a large area, which is the expensive
operation per section 4.3; and physically it is wrong, because a panel in front of a light source
is a silhouette, not an emitter. The one place a glow is correct is on things that *are* emitting:
the subsolar point marker, the city lights, and possibly the active state of a control. Keep those
inside the WebGL layer where they cost nothing extra.

**On rounding.** Keep `border-radius` at 2 to 4 px. Sextants, chronometers and chart tables have
small, machined radii. A 16px radius is a phone app.

### 4.6 Film grain: recipes, measurements, and one nasty gotcha

#### Recipe A (recommended for DOM chrome): inline SVG feTurbulence as a CSS background

```css
.grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>");
}
```

That data URI is **306 characters**. It renders correctly in Chromium, Firefox and WebKit
(VERIFIED, measured, by sampling the rendered pixels in each engine, not just by reading the
computed style).

`feTurbulence` attributes, defaults from MDN
(https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence):

| Attribute | Default | Range | Effect here |
|---|---|---|---|
| `type` | `turbulence` | `fractalNoise` / `turbulence` | Use `fractalNoise`. `turbulence` gives a swirly, clumpy result that reads as smoke, not grain. |
| `baseFrequency` | none | 0 to 1 | Grain size. See the warning below. |
| `numOctaves` | 1 | 1+ | Detail. 2 is the sweet spot; 3 adds nothing visible and 4+ costs paint time. |
| `seed` | 0 | 0+ | Set it if you want reproducible screenshots. |
| `stitchTiles` | `noStitch` | `noStitch` / `stitch` | **Set `stitch`** or the tile edges will show as a grid at 300px intervals. |

#### GOTCHA: baseFrequency = 1.0 produces perfectly flat grey

VERIFIED (measured). Rendered over `#0a0f16` at dpr 1 and sampled:

| baseFrequency | numOctaves | opacity | mean L | **stdev L** | min | max |
|---|---|---|---|---|---|---|
| 0.65 | 2 | 0.03 | 15.79 | 0.88 | 13 | 19 |
| 0.65 | 2 | 0.05 | 17.62 | 1.32 | 13 | 23 |
| 0.65 | 2 | 0.08 | 20.17 | 1.95 | 14 | 28 |
| 0.65 | 2 | 0.12 | 24.24 | 2.93 | 15 | 35 |
| 0.80 | 1 | 0.05 | 17.63 | 1.20 | 14 | 23 |
| 0.80 | 2 | 0.05 | 17.63 | 1.33 | 13 | 23 |
| 0.80 | 3 | 0.05 | 17.63 | 1.36 | 13 | 23 |
| **1.00** | 1, 2 or 3 | 0.03 | 16.00 | **0.00** | 16 | 16 |
| **1.00** | 1, 2 or 3 | 0.12 | 24.00 | **0.00** | 24 | 24 |

At `baseFrequency: 1.0` the Perlin lattice period is exactly one device pixel, so every sample
lands on a lattice node where gradient noise evaluates to zero. You get a uniform grey wash, and
because it is a *wash* it still lifts your black level while contributing no texture at all. Stay
at or below about 0.85. Anything in 0.6 to 0.85 is good grain.

Also note `numOctaves` above 2 gains almost nothing: stdev went 1.20, 1.33, 1.36 for octaves 1, 2,
3. Use 2.

#### Paint cost

Full-screen `feTurbulence` first paint, measured as time from DOM insertion to the second
requestAnimationFrame at 1536 x 864 CSS px. The measurement floor is one vsync (13.89 ms).

| baseFrequency | numOctaves | ms |
|---|---|---|
| 0.2 | 1 | 33.6 |
| 0.2 | 2 | 13.5 |
| 0.5 | 1 | 12.9 |
| 0.5 | 2 | 11.0 |
| 0.8 | 1 | 13.3 |
| 0.8 | 2 | 14.0 |
| 0.8 | 3 | 13.3 |
| 1.2 | 4 | 13.0 |

VERIFIED (measured). Everything except one outlier is at or under the vsync floor, i.e. the noise
rasterises inside a single frame and is then cached as a texture. Steady-state cost over an
animating canvas was **+0.30 ms/frame** even at GPU saturation (section 4.3). This is cheap.

#### Recipe B: tiled PNG noise, and why not to

Measured byte sizes of a canvas-generated noise PNG:

| Tile | Content | PNG bytes | As a data URI (chars) |
|---|---|---|---|
| 64 x 64 | RGBA random | 14,300 | 19,066 |
| 64 x 64 | grayscale random | 7,334 | 9,778 |
| 64 x 64 | grayscale, 4 levels | 3,782 | 5,042 |
| 128 x 128 | RGBA random | 56,552 | 75,402 |
| 128 x 128 | grayscale random | **26,666** | 35,554 |
| 128 x 128 | grayscale, 4 levels | 14,483 | 19,310 |
| 256 x 256 | RGBA random | 225,188 | 300,250 |
| 256 x 256 | grayscale random | 103,478 | 137,970 |
| 256 x 256 | grayscale, 4 levels | 50,942 | 67,922 |

VERIFIED (measured).

Random noise is by definition incompressible. A 128 x 128 grayscale tile at 26.7 KB costs **more
than an entire subsetted variable font** (Archivo UI is 17.5 KB) and shows visible repetition at
128px. Its steady-state cost was also higher than the SVG (+1.47 ms/frame versus +0.30 ms/frame).

**Use the SVG. It is 306 bytes and it is faster.** The only reason to reach for a PNG is if you
want a specific hand-authored grain (scanned film stock, halftone), which is not the register here.

#### GOTCHA: grain lifts your black level, and blend modes do not save you

VERIFIED (measured). Same `feTurbulence` layer over four bases:

| Base | blend mode | opacity | mean L | stdev L |
|---|---|---|---|---|
| `#000000` | `normal` | 0.05 | 4.63 | 1.32 |
| `#000000` | `normal` | 0.18 | 16.67 | 4.32 |
| `#000000` | **`overlay`** | 0.05 to 0.18 | **0.00** | **0.00** |
| `#000000` | **`soft-light`** | 0.05 to 0.18 | **0.00** | **0.00** |
| `#0a0f16` (L 14) | `normal` | 0.05 | 17.63 | 1.32 |
| `#0a0f16` | `overlay` | 0.05 | 14.94 | **0.23** |
| `#0a0f16` | `soft-light` | 0.05 | 14.21 | **0.40** |
| `#7a8899` (mid) | `normal` | 0.05 | 134.64 | 0.72 |
| `#7a8899` | `soft-light` | 0.05 | 134.60 | 0.49 |
| `#f0b25a` (sunlit) | `normal` | 0.05 | 185.68 | 0.63 |
| `#f0b25a` | `soft-light` | 0.05 | 187.00 | **0.00** |

Read that carefully:

- `mix-blend-mode: overlay` and `soft-light` produce **literally zero grain on pure black**, which
  is exactly where you want it on a night-side map, and near-zero (stdev 0.23) on a very dark
  panel. They are useless for this app.
- `mix-blend-mode: normal` is the only mode that gives usable grain across the whole luminance
  range, and its price is a black-level lift: at opacity 0.05 the darkest pixel rises from L 0 to
  a mean of L 4.63.

**Two acceptable resolutions.**

1. **Do not use pure black for the night side.** Set `--void` to `#04070C` (L 0.0020, i.e. L 4 out
   of 255) rather than `#000000`. Then a `normal`-blend grain at opacity 0.03 to 0.04 lifts almost
   nothing you can see, and gives stdev around 0.3 to 0.35 percent of the luminance range. This is
   the recommendation for the DOM chrome layer.
2. **Better for the map itself: put the grain in the fragment shader**, where you can add
   *signed*, zero-mean noise instead of compositing a positive-mean layer. This has no black-level
   lift at all, costs nothing extra, and automatically follows the map's own tone.

```glsl
// zero-mean grain, in the map fragment shader, applied last
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// amplitude 0.006 in linear space is roughly the 0.3% stdev measured above
float g = (hash12(gl_FragCoord.xy + uFrameSeed) - 0.5) * 0.012;
color += vec3(g);
```

**Recommended final values**: `baseFrequency: 0.8`, `numOctaves: 2`, `stitchTiles: stitch`,
`type: fractalNoise`, `mix-blend-mode: normal`, `opacity: 0.035` on the DOM chrome layer, and a
shader grain of amplitude 0.012 (peak to peak, linear) on the map. Measured luminance stdev at
opacity 0.035 with `normal` blend is about 0.35 percent of full range, which is present under
scrutiny and invisible in normal use, which is exactly right.

#### Grain and reduced motion

Do **not** animate the grain (do not re-seed it per frame). Animated film grain at 60 Hz is a
strong vestibular trigger and it forces a full-screen repaint every frame. A static grain is
correct here and costs nothing.

### 4.7 Vignetting

A vignette does two jobs at once in this app: it stops the map's bright limb from fighting the
chrome at the edges, and it darkens exactly the region where controls live.

The trap is that a vignette on a *map* is a lie: it darkens real data. A heliograph's whole point
is where the light falls, so a heavy vignette is a factual error.

**Recommendation: a very light, off-centre, non-uniform vignette applied as a DOM layer, not to
the map texture, biased toward the edges where chrome sits.**

```css
.vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 30;
  background:
    /* corner falloff, deliberately weak */
    radial-gradient(
      140% 110% at 50% 46%,
      transparent 46%,
      rgb(2 4 8 / 0.18) 78%,
      rgb(2 4 8 / 0.42) 100%
    ),
    /* stronger at the bottom where the control rail lives */
    linear-gradient(to top, rgb(2 4 8 / 0.30) 0%, transparent 22%);
}
```

Numbers to keep to (UNVERIFIED as a rule, but grounded in the contrast maths above): peak vignette
alpha at the extreme corner **0.42 or less**, and zero alpha across the central 46 percent radius
so the terminator, which is the subject, is never dimmed. The bottom linear component is separate
so you can turn it off when the control rail is hidden.

Note the vertical offset (`at 50% 46%`): centring the vignette exactly makes it look like a lens
artefact pasted on top. Lifting the centre 4 percent makes it read as the natural falloff of a
lit sphere.

### 4.8 Text rendering on dark grounds

Light text on a dark ground optically gains weight, so a weight that looks right on white looks
bold and slightly smeared on near-black. Two mitigations:

```css
:root {
  -webkit-font-smoothing: antialiased;      /* macOS/Chromium: grayscale AA, thins light-on-dark */
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

Caveats:

- `-webkit-font-smoothing: antialiased` disables subpixel antialiasing. On a dark ground this
  usually helps, because subpixel AA on light-on-dark produces coloured fringes that read as
  bloom. It is a per-project judgement, not a rule. (UNVERIFIED: this is the standard practitioner
  fix; I did not measure perceived weight.)
- `text-rendering: optimizeLegibility` enables kerning and ligatures and can be slow on very large
  text runs. It also conflicts with the `font-kerning: none` you want on readouts, so scope it
  away from the numeric elements.
- The more reliable fix is **use a lighter weight than you would on white**. With a variable font
  this is free: set body text to `font-weight: 380` rather than 400, and headings to 560 rather
  than 600. All three UI candidates support arbitrary intermediate weights.

---

## 5. Micro-interaction timing for controls that should feel like hardware

### 5.1 The two anchors

**Anchor 1, perception.** Jakob Nielsen's three limits: "0.1 second is about the limit for having
the user feel that the system is reacting instantaneously, meaning that no special feedback is
necessary except to display the result."
https://www.nngroup.com/articles/response-times-3-important-limits/

For a precision instrument this is the governing number. Anything that responds to a direct
pointer or key action must complete, or at least visibly commit, inside 100 ms.

**Anchor 2, published tokens.** Two design systems publish exact values from source. I use IBM
Carbon's "productive" set as the base because its whole framing is "productive versus expressive",
and an instrument is the productive case.

IBM Carbon, from `packages/motion/src/dtcg/motion.json` in the carbon-design-system repository
(VERIFIED, source):

| Token | ms | Carbon's own description |
|---|---|---|
| `fast-01` | **70** | "Micro-interactions such as button and toggle. Instant response to user action." |
| `fast-02` | **110** | "Micro-interactions such as fade in. Subtle entrance or exit of small UI elements." |
| `moderate-01` | **150** | "Micro-interactions, small expansion, short distance movements. Default transition speed." |
| `moderate-02` | **240** | "Expansion, system communication, toast. Slightly longer interactions with more visual weight." |
| `slow-01` | **400** | "Large expansion, important system notifications. Deliberate, prominent transitions." |
| `slow-02` | **700** | "Background dimming, large hero transitions. Slow, immersive motion for maximum emphasis." |

| Carbon easing | productive | expressive |
|---|---|---|
| standard | `cubic-bezier(0.2, 0, 0.38, 0.9)` | `cubic-bezier(0.4, 0.14, 0.3, 1)` |
| entrance | `cubic-bezier(0, 0, 0.38, 0.9)` | `cubic-bezier(0, 0, 0.3, 1)` |
| exit | `cubic-bezier(0.2, 0, 1, 0.9)` | `cubic-bezier(0.4, 0.14, 1, 1)` |

Material 3, from `androidx/compose/material3/tokens/MotionTokens.kt` (VERIFIED, source), for
cross-reference:

| Token | ms | | Easing | cubic-bezier |
|---|---|---|---|---|
| short1..4 | 50, 100, 150, 200 | | emphasized | `0.2, 0.0, 0.0, 1.0` |
| medium1..4 | 250, 300, 350, 400 | | emphasized decelerate | `0.05, 0.7, 0.1, 1.0` |
| long1..4 | 450, 500, 550, 600 | | emphasized accelerate | `0.3, 0.0, 0.8, 0.15` |
| extraLong1..4 | 700, 800, 900, 1000 | | standard | `0.2, 0.0, 0.0, 1.0` |
| | | | standard decelerate | `0.0, 0.0, 0.0, 1.0` |
| | | | standard accelerate | `0.3, 0.0, 1.0, 1.0` |
| | | | legacy | `0.4, 0.0, 0.2, 1.0` |

### 5.2 The heliograph motion tokens

```css
:root {
  /* durations */
  --t-instant:  70ms;   /* Carbon fast-01   : hover, press, focus ring */
  --t-quick:   110ms;   /* Carbon fast-02   : small fades, tooltip, value flash */
  --t-base:    150ms;   /* Carbon moderate-01: default. Panel content, tab switch */
  --t-weighty: 240ms;   /* Carbon moderate-02: panel entry/exit, drawer */
  --t-heavy:   400ms;   /* Carbon slow-01   : first-load reveal steps */
  --t-scene:   700ms;   /* Carbon slow-02   : the map's own first fade-up */

  /* easing: productive set. An instrument does not bounce, overshoot, or spring. */
  --e-standard: cubic-bezier(0.2, 0, 0.38, 0.9);
  --e-enter:    cubic-bezier(0, 0, 0.38, 0.9);
  --e-exit:     cubic-bezier(0.2, 0, 1, 0.9);
  /* the one custom curve: a hard mechanical detent for press */
  --e-detent:   cubic-bezier(0.3, 0, 0.1, 1);
}
```

Note there is no spring, no `cubic-bezier` with a y value above 1, and no overshoot anywhere. A
sextant drum does not wobble past its mark. If you take one thing from this section: **overshoot
is the single fastest way to make a precision instrument feel like a toy.**

### 5.3 Per-interaction specification

| Interaction | Property | Duration | Easing | Notes |
|---|---|---|---|---|
| **Hover in** | `background-color`, `color`, `border-color` | 70 ms | `--e-standard` | Under the 100 ms perceptual threshold. Never move the element. |
| **Hover out** | same | 110 ms | `--e-exit` | Slightly slower out than in. Fast-in / slow-out reads as responsive; the reverse reads as sticky. |
| **Press down** | `transform: scale(0.985)` or `translateY(1px)`, plus `background-color` | **0 ms (instant)** to 70 ms | `--e-detent` | A real switch has no ramp on the down stroke. Prefer instant. |
| **Press release** | same, back | 110 ms | `--e-exit` | The return is the spring in the switch, so it may ramp. |
| **Focus ring appear** | `box-shadow` / `outline-offset` | 70 ms | `--e-enter` | Must be instant enough for keyboard users to track. Never animate `outline-width`. |
| **Panel entry** | `opacity` 0 to 1, `transform: translateY(8px)` to 0 | 240 ms | `--e-enter` | 8px, not 24px. Instrument panels slide a hair, they do not fly. |
| **Panel exit** | `opacity` 1 to 0, `transform` 0 to `translateY(4px)` | 150 ms | `--e-exit` | Exits are always faster than entries: the user has already decided. |
| **Value change (digit)** | `transform: translateY` | 140 ms | `--e-standard` | See section 3.5. |
| **Value change (flash)** | `color` | 220 ms | `--e-enter` | Only the changed element. |
| **Slider thumb drag** | none | **0 ms** | none | A dragged control must be 1:1 with the pointer. Any transition here is a bug. |
| **Slider snap to detent** | `transform: translateX` | 110 ms | `--e-detent` | Only when the user releases. |
| **Tooltip / readout popover** | `opacity` + 4px `translateY` | 110 ms in, 70 ms out | `--e-enter` / `--e-exit` | Add 300 to 500 ms open delay, 0 ms close delay. |
| **Toggling a map layer** | `opacity` of the layer | 240 ms | `--e-standard` | Crossfade in the shader, not by stacking two canvases. |
| **Date/time jump (scrub release)** | shader `uTime` interpolation | 400 ms | `--e-standard` | Only for a discrete jump such as "now". Continuous scrubbing is 1:1. |

Implementation notes:

- **Only animate `transform`, `opacity` and `filter`.** Everything in the table above obeys this
  except `background-color` and `color`, which are paint-only and cheap on small elements. Never
  transition `width`, `height`, `top`, `left`, `margin` or `padding` on anything sitting over the
  canvas; each one triggers layout, and layout over a 60 fps canvas is where jank comes from.
- **Do not put `will-change` on controls speculatively.** Each promoted layer costs GPU memory,
  and over a full-screen WebGL canvas you are already at the memory budget. Add it only to the one
  element you have measured as a problem, and remove it when the animation ends.
- **`transition-behavior: allow-discrete`** plus `@starting-style` is the clean modern way to
  animate a panel that goes `display: none`, and avoids the classic double-rAF hack.

### 5.4 Page load sequence

The goal is that the instrument appears to *power on*, in the sense of a real device: the display
lights before the labels, the labels before the controls, and nothing bounces.

Total budget: **under 900 ms from first paint to fully interactive-looking.** Anything longer and
you are past Nielsen's 1 second "flow of thought" limit.

| Step | Starts at | Duration | What | Easing |
|---|---|---|---|---|
| 0 | 0 ms | 0 | Page background painted at `--void`. Nothing else. Fonts are already present (base64), so there is no FOUT to hide. | |
| 1 | 0 ms | 700 ms | Map canvas fades from `opacity: 0` to 1 **and** the shader's own exposure ramps from 0 to 1. Doing it in the shader as well as in CSS makes the terminator resolve out of blackness rather than the whole plate brightening uniformly. | `--e-enter` |
| 2 | 180 ms | 400 ms | Graticule and coastline strokes fade in, from the shader. | `--e-enter` |
| 3 | 320 ms | 240 ms | Subsolar point marker scales from 0.7 to 1 and fades in. This is the only scale animation in the whole app, and it is the subject, so it earns it. | `--e-enter` |
| 4 | 420 ms | 240 ms | Control rail and panels: `opacity` 0 to 1, `translateY(8px)` to 0. All at once, not staggered per control. | `--e-enter` |
| 5 | 560 ms | 220 ms | Primary readout digits: `opacity` 0 to 1 only, no movement, no roll. The clock must appear already correct. | `--e-enter` |
| 6 | 780 ms | 110 ms | Secondary legends and faint labels fade to their final `--text-3`. | `--e-enter` |

Two rules for this sequence:

- **Never stagger individual controls.** A per-item cascade across a control rail is a portfolio
  site move. Panels arrive as units, because they are physical units.
- **The clock never animates its value on load.** It does not count up from 00:00:00. It is
  correct from the first frame it is visible.

### 5.5 prefers-reduced-motion

MDN's framing is the right one: reduce "does not mean no motion at all", it means "replacing or
reducing motion-based animations, particularly those that could trigger vestibular motion
disorders". https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

The blunt global reset is a bad fit here, because it would also kill the digit roll (harmless) and
say nothing useful about the map (the actual problem). Use a two-layer strategy.

**Layer 1: token substitution, not blanket disabling.**

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --t-instant: 1ms;
    --t-quick:   1ms;
    --t-base:    1ms;
    --t-weighty: 1ms;
    --t-heavy:   1ms;
    --t-scene:   1ms;
  }
  /* kill translation, keep opacity: fades are not vestibular triggers */
  .panel, .rail, .card { transform: none !important; }
  .slot > i { transition: none; }
}
```

Using `1ms` rather than `0s` keeps `transitionend` handlers firing, which avoids a whole class of
"the panel never finished opening so the state machine is stuck" bugs.

**Layer 2: the continuously animating data view.** This is the hard part and the reason a global
reset is insufficient.

The relevant criterion is **SC 2.2.2 Pause, Stop, Hide**: "For any moving, blinking or scrolling
information that (1) starts automatically, (2) lasts more than five seconds, and (3) is presented
in parallel with other content, there is a mechanism for the user to pause, stop, or hide it
unless the movement, blinking, or scrolling is part of an activity where it is essential."
https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html

A heliograph has three distinct kinds of continuous motion, and they need different treatment:

| Motion | Is it essential? | Reduced-motion behaviour |
|---|---|---|
| **The terminator advancing in real time** | Arguably yes, it is the subject. But at real time it moves about 0.25 degrees of longitude per minute, which is imperceptible frame to frame. | **Keep it, but stop redrawing every frame.** Drop to one update per second (or per 10 seconds). No perceptible motion, full correctness, and it stops being an animation in the SC 2.2.2 sense. |
| **Animating through a day or a year (the play button)** | Essential to that activity, and it is user-initiated, so SC 2.2.2's "starts automatically" does not apply. | **Keep it, but do not autoplay.** Never start playback on load. Halve the default playback rate under reduced motion, and offer a step control (step one hour / one day) as the equivalent non-animated path. |
| **Decorative motion: grain shimmer, glow pulse, marker breathing, gradient drift** | No. | **Remove entirely.** |

Concretely:

```js
const rm = window.matchMedia('(prefers-reduced-motion: reduce)');

function frameBudget() {
  if (state.playing) return rm.matches ? 2 : 1;   // render every Nth frame while playing
  return rm.matches ? Infinity : 1;               // when idle, reduced-motion = event-driven only
}

// When idle and reduced motion is on, do not run a rAF loop at all.
// Redraw on: user input, a 1 s clock tick, or a resize.
function scheduleIdleRedraw() {
  if (rm.matches) {
    clearInterval(idleTimer);
    idleTimer = setInterval(() => render(Date.now()), 1000);
    return;
  }
  requestAnimationFrame(loop);
}
rm.addEventListener('change', scheduleIdleRedraw);
```

Additional requirements that follow from SC 2.2.2 regardless of the media query:

- **A visible pause control is mandatory** whenever playback is running, and it must be reachable
  by keyboard. `Space` is the conventional binding.
- **A visible speed control**, because the criterion offers "control the frequency of the update"
  as an alternative to pausing.
- Also honour `prefers-reduced-transparency` by dropping the `backdrop-filter` accent and raising
  the scrim alpha, and `prefers-contrast: more` by moving `--text-3` up to `--text-2` and raising
  hairline alpha from 0.07 to 0.20.

---

## 6. Layout: one instrument, 4K down to 390 px

### 6.1 Locking the viewport correctly

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
```

- `viewport-fit=cover` is what makes `env(safe-area-inset-*)` non-zero. Values are `auto`
  (default), `contain`, `cover`. MDN on `cover`: "The viewport is scaled to fill the device
  display. It's highly recommended to use the safe area inset variables to ensure that important
  content doesn't end up outside the display."
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport
- `interactive-widget` defaults to `resizes-visual`. Use `resizes-content` so that when the
  on-screen keyboard appears (a "jump to date" text field), the layout viewport itself shrinks and
  your viewport units recompute, rather than the page being scrolled under a keyboard you cannot
  see. Values: `resizes-visual` (default), `resizes-content`, `overlays-content`.
- Do **not** set `user-scalable=no` or `maximum-scale=1`. It fails WCAG 1.4.4 Resize Text and iOS
  ignores it anyway.

```css
html, body {
  block-size: 100%;
  margin: 0;
  overflow: hidden;                 /* no page scroll, ever */
  overscroll-behavior: none;        /* kill rubber-banding and pull-to-refresh */
  background: var(--void);
}
#app {
  position: fixed;
  inset: 0;
  block-size: 100dvh;               /* dynamic: follows the collapsing address bar */
  block-size: 100svh;               /* fallback order matters: see below */
}
#map {
  position: absolute;
  inset: 0;
  touch-action: none;               /* the canvas owns all gestures */
}
```

**On `dvh` versus `svh`.** MDN's warning is real: "using viewport-percentage units based on the
dynamic viewport size can cause the content to resize while a user is scrolling a page. This can
lead to degradation of the user interface and cause a performance hit."
https://developer.mozilla.org/en-US/docs/Web/CSS/length

For this app the page never scrolls, so the address bar never collapses in response to scrolling,
so `dvh` will not thrash. But a WebGL canvas resize is expensive (it reallocates the drawing
buffer). The safe pattern is:

- Use `100svh` for the **canvas**, so its size is stable and it never reallocates.
- Use `100dvh` for the **chrome layer**, so the bottom control rail tracks the browser UI.
- Let the canvas be slightly taller than the visible area rather than resize it.

Also debounce any real canvas resize and never do it inside the rAF loop:

```js
const ro = new ResizeObserver(() => { pendingResize = true; });
ro.observe(document.getElementById('app'));
// inside the loop, at most once per frame, and only when it actually changed:
if (pendingResize) { applyCanvasSize(); pendingResize = false; }
```

### 6.2 Safe area insets

WebKit introduced `env()` with the four `safe-area-inset-*` variables in iOS 11, and renamed the
original `constant()` to `env()` in iOS 11.2.
https://webkit.org/blog/7929/designing-websites-for-iphone-x/

The correct combination pattern, quoted from that article: "we want to use `max()`:
`padding-left: max(12px, env(safe-area-inset-left));`"

```css
:root {
  --gutter: clamp(12px, 1.6vw, 28px);
  --safe-t: max(var(--gutter), env(safe-area-inset-top, 0px));
  --safe-r: max(var(--gutter), env(safe-area-inset-right, 0px));
  --safe-b: max(var(--gutter), env(safe-area-inset-bottom, 0px));
  --safe-l: max(var(--gutter), env(safe-area-inset-left, 0px));
}
.chrome {
  padding: var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l);
}
```

Three practical points:

- **Always supply the `0px` fallback** in `env()`. On a browser that does not know the variable,
  `env(safe-area-inset-top)` with no fallback makes the whole declaration invalid, and your
  padding silently disappears.
- **Landscape phones are the case that actually bites.** The notch or camera moves to the left or
  right, so `safe-area-inset-left` / `-right` become non-zero (typically 44 to 59 px). A control
  rail pinned to the left edge will be under the notch. This is more common in a map app than in
  a document, because people rotate to see more longitude.
- MDN also documents `safe-area-max-inset-*` (the static maximum when all dynamic UI is retracted)
  and `keyboard-inset-*`. `safe-area-max-inset-bottom` is useful for reserving space that does not
  jitter as the iOS home indicator bar shows and hides.
  https://developer.mozilla.org/en-US/docs/Web/CSS/env
- The map canvas itself extends **under** the safe areas (that is the point of `viewport-fit=cover`);
  only the chrome respects them.

### 6.3 Breakpoints and where the controls go

Break on **layout capability**, not on device names. Four states.

#### State 1: Console (>= 1440 px wide, up to 4K)

```
+--------------------------------------------------------------+
|  ◉ HELIOGRAPH            [readout: UTC 14:07:32]        [⚙]  |  <- 56px top rail
+------------------+-------------------------------------------+
|                  |                                           |
|  LEFT DOSSIER    |                                           |
|  320px fixed     |            M A P   (fills)                |
|                  |                                           |
|  subsolar pt     |                                           |
|  lat/lon         |                                           |
|  declination     |                                           |
|  eq. of time     |                                           |
|  sunrise/set     |                                           |
|                  |                                           |
+------------------+-------------------------------------------+
|  [◀◀] [▶] [▶▶]  ═══════●══════════════  1x   day | year      |  <- 88px scrub rail
+--------------------------------------------------------------+
```

- Left dossier at a **fixed 320 px**, not a percentage. Data panels should not reflow with the
  viewport; the map takes the slack. At 4K this means the map gets 3520 px and the panel stays
  legible, which is right. A percentage panel at 4K becomes an absurd 600 px column of 14px text.
- Scrub rail is full width at the bottom, which is where a timeline belongs and where the
  vignette is already darkest.
- **4K specifics**: do not scale the whole UI with `vw`. Instead raise the base font size one
  step (`16px` to `17px` above 2560 px) and let the map absorb the extra area. An instrument at 4K
  should show *more map*, not bigger buttons. Cap the readout size with
  `clamp(28px, 2.2vw, 44px)`.
- Cap the total chrome width so the layout does not stretch absurdly on an ultrawide:
  `max-inline-size: 2400px; margin-inline: auto` on the chrome layer only, never on the canvas.

#### State 2: Desk (900 to 1439 px)

- Left dossier collapses to a **toggleable overlay drawer**, 320 px, over the map, with the scrim
  from section 4.3. Default closed.
- Top rail keeps the title and readout; the settings gear moves into the drawer.
- Scrub rail unchanged.

#### State 3: Tablet / large phone landscape (600 to 899 px)

- No dossier drawer by default; the three most important values (subsolar lat/lon, UTC, local)
  move into the **top rail** as a single tabular line.
- Scrub rail loses the speed multiplier chips and keeps `[▶]` plus the scrubber plus a single
  `day | year` toggle.
- Watch `safe-area-inset-left/right` here: this is the landscape-notch case.

#### State 4: Phone (< 600 px, down to 390 px and below)

```
+---------------------------+
|            (safe top)     |
|  UTC 14:07:32        [i]  |  <- 44px, tabular, this is the whole readout
+---------------------------+
|                           |
|                           |
|          M A P            |
|      (fills, and the      |
|      map is the point)    |
|                           |
|                           |
+---------------------------+
| ═════════●══════════════  |  <- 44px scrubber, full width
|  [▶]   14 Aug   1x   [⋯]  |  <- 52px, 4 targets minimum 44x44
|            (safe bottom)  |
+---------------------------+
```

Rules for the phone state:

- **The map must keep at least 60 percent of the vertical space.** Chrome budget: 44 px top +
  96 px bottom + safe areas. At 390 x 844 that leaves 704 px of map, which is 83 percent.
- **Targets.** SC 2.5.8 Target Size (Minimum), Level AA: "The size of the target for pointer
  inputs is at least 24 by 24 CSS pixels", with exceptions for spacing, equivalent controls,
  inline targets, user-agent controls, and essential presentation. SC 2.5.5 (Enhanced, AAA) is
  44 by 44. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  **Use 44 x 44 as the floor on touch**, not 24. On an instrument the user is often pressing while
  looking at the map, not at the button.
  ```css
  @media (pointer: coarse) {
    .control { min-inline-size: 44px; min-block-size: 44px; }
  }
  ```
- **The scrubber gets its own full-width row.** A slider sharing a row with buttons on a 390 px
  screen ends up about 180 px long, which is a resolution of roughly 8 minutes per pixel over a
  day. Give it the full width and it becomes 2 minutes per pixel.
- **Increase the scrubber's hit area without increasing its visual height** using a transparent
  pseudo-element, so it looks like a 4 px hairline track and behaves like a 44 px band:
  ```css
  .scrub { block-size: 4px; position: relative; }
  .scrub::before { content: ''; position: absolute; inset: -20px 0; }
  ```

### 6.4 What to drop, in order

Drop from the bottom of this list first as space shrinks. Each item names the state at which it
goes.

| # | Feature | Dropped at | Replacement |
|---|---|---|---|
| 1 | Timezone name labels drawn on the map | < 1440 px | Tap or hover a zone to get a label |
| 2 | The left dossier as a permanent panel | < 1440 px | Toggleable drawer |
| 3 | Equation of time, declination, distance | < 900 px | Behind an "info" sheet |
| 4 | Sunrise / sunset table for the hovered location | < 900 px | Tap the map for a single popover |
| 5 | Speed multiplier chips (0.5x 1x 5x 60x) | < 900 px | Long-press the play button cycles speed |
| 6 | The graticule at 15 degree spacing | < 768 px | 30 degree spacing, or off |
| 7 | City lights labels | < 768 px | Lights render, labels do not |
| 8 | Separate `day` / `year` scrub modes | < 600 px | One scrubber, mode in the overflow menu |
| 9 | Local time for the hovered timezone | < 600 px | Only on tap |
| 10 | The seconds field of the main readout | < 390 px | `14:07` only. Also do this at any width when playback speed > 1x. |
| 11 | The app title | < 390 px | Icon only |
| 12 | Grain and vignette | never drop for size | Drop only for `prefers-reduced-transparency` |

What must **never** be dropped, at any size:

- The map itself at full bleed.
- A visible pause control while playback is running (SC 2.2.2).
- The current date and time in some form.
- Keyboard access to the scrubber (arrow keys step, `Home`/`End` jump, `Space` plays).

### 6.5 The shell skeleton

```css
#shell {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'top    top'
    'aside  map'
    'scrub  scrub';
  pointer-events: none;             /* the shell is a frame; children opt in */
}
#shell > * { pointer-events: auto; }
#map { grid-area: 1 / 1 / -1 / -1; pointer-events: auto; }  /* map spans everything, behind */

@media (max-width: 1439px) {
  #shell { grid-template-columns: 1fr; grid-template-areas: 'top' 'map' 'scrub'; }
  #aside { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: 320px; }
}
@media (max-width: 599px) {
  #shell { grid-template-rows: auto 1fr auto auto; }
}
@media (pointer: coarse) { :root { --gutter: 16px; } }
@media (hover: none)     { .tooltip { display: none; } }   /* no hover, no tooltips */
```

The `pointer-events: none` on the shell with `auto` on children is the important trick: it lets
the map receive drag and wheel events through the gaps between panels, so a user can pan the map
by grabbing the space next to the control rail. Without it, the invisible grid container eats
every gesture that is not directly on a control.

---

## Appendix A: sources

Primary sources, all fetched during this research.

**Fonts and licensing**
- `google/fonts` METADATA.pb, e.g. https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/METADATA.pb
  (and `archivo`, `martianmono`, `newsreader`, `instrumentsans`, `sometypemono`, `bigshoulders`,
  `recursive`, `doto`, `saira`)
- SIL Open Font License 1.1: https://openfontlicense.org/open-font-license-official-text/
- Google Fonts CSS API: https://fonts.googleapis.com/css2
- fontTools subset docs: https://fonttools.readthedocs.io/en/latest/subset/index.html
- subset-font: https://github.com/papandreou/subset-font and https://registry.npmjs.org/subset-font/latest
- harfbuzzjs: https://github.com/harfbuzz/harfbuzzjs

**CSS and web platform**
- font-variant-numeric: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- Variable fonts guide: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_fonts/Variable_fonts_guide
- @property: https://developer.mozilla.org/en-US/docs/Web/CSS/@property
- backdrop-filter: https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- Filter Effects 2 spec: https://drafts.csswg.org/filter-effects-2/
- Chromium Intent to Ship, Backdrop Filter: https://groups.google.com/a/chromium.org/g/blink-dev/c/GRl1_Qy97jM
- web.dev backdrop-filter: https://web.dev/articles/backdrop-filter
- feTurbulence: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence
- env(): https://developer.mozilla.org/en-US/docs/Web/CSS/env
- viewport meta: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport
- viewport units: https://developer.mozilla.org/en-US/docs/Web/CSS/length
- prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- WebKit, Designing Websites for iPhone X: https://webkit.org/blog/7929/designing-websites-for-iphone-x/

**Accessibility**
- SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- SC 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- SC 2.2.2 Pause, Stop, Hide: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- SC 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

**Motion**
- IBM Carbon motion tokens (source of truth):
  https://raw.githubusercontent.com/carbon-design-system/carbon/main/packages/motion/src/dtcg/motion.json
- Material 3 motion tokens (source of truth):
  https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MotionTokens.kt
- Nielsen, Response Times: https://www.nngroup.com/articles/response-times-3-important-limits/

## Appendix B: reproducing the measurements

All measurement scripts were written and run during this research. To reproduce:

1. **Font metadata and features**: download the upstream variable TTFs from
   `raw.githubusercontent.com/google/fonts/main/ofl/<family>/<File[axes].ttf>` (URL-encode the
   brackets as `%5B` and `%5D`), then read `GSUB`/`GPOS` FeatureList, `hmtx`, `cmap` and `OS/2`
   with fontTools.
2. **Digit widths across axes**: `fontTools.varLib.instancer.instantiateVariableFont` at each
   weight, then read `hmtx.metrics` for the digit glyphs and for the `.tf` glyphs that `tnum`
   maps to.
3. **Subset sizes**: `fonttools varLib.instancer` then `pyftsubset --flavor=woff2` with the
   charsets and feature lists given in section 2.2.
4. **base64 and brotli**: `base64.b64encode`, then `brotli.compress(css, quality=11)` on the full
   `@font-face` rule.
5. **Browser verification**: Playwright with all three engines, base64 `@font-face` in a
   `file://` page, `await document.fonts.load(...)` per family and weight before measuring
   `getBoundingClientRect().width` of off-screen spans.
6. **backdrop-filter cost**: a full-viewport WebGL2 fractal-noise shader with a runtime-adjustable
   octave count, rAF interval sampling over 2.5 s per condition, run at increasing octave counts
   until the GPU saturated and composite cost became separable.
7. **Grain statistics**: Playwright screenshots of the grain layer over known base colours,
   analysed with Pillow for mean, standard deviation, min and max of the luminance channel.
