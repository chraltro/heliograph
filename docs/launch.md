# Launching it

A note on what this document is. Traffic is not something the code can produce:
it comes from people posting the link somewhere people are, and from the thing
being good enough that they pass it on. What the code *can* do is make sure that
when somebody does post it, the link works, unfurls, loads fast, and survives
the front page. That part is done, and is listed at the bottom.

## The one number that matters first

You cannot tell whether you reached a hundred thousand people without counting
them, and nothing in this app counts anything today. That is a deliberate
property worth keeping in mind: the README says nothing is fetched at runtime,
and it is currently true. Any analytics breaks that sentence, so it is a choice
rather than an obvious win.

Three options, in increasing order of what they cost you:

- **GitHub Pages gives you nothing.** No logs, no counts. So without adding
  something, the honest answer to "did it hit 100k" is that you will never know.
- **A privacy-preserving counter.** Plausible or Umami, self-hosted or paid,
  one script tag, no cookies, no consent banner needed in the EU. Roughly
  1 KB. This is the option that fits the project: it counts uniques and
  referrers and nothing else.
- **Cloudflare in front of Pages.** Free, gives you request analytics with no
  client-side script at all, and caches the 2 MB of assets at the edge. This
  costs you a DNS change and nothing in the page.

My recommendation is Cloudflare, because it adds no code to the page and the
edge cache is genuinely useful if a front page happens.

## Where the people actually are

Ordered by how well this particular thing fits.

**Hacker News, as a Show HN.** This is the best fit by some distance: it is a
technical audience, the project is unusually well documented, and the details
that make it interesting (the twilight spectrum, the NOAA sunrise failure above
63 degrees, the Meeus lunar series, eclipses from geometry rather than tables)
are exactly what that audience reads the comments for. Post Tuesday to Thursday,
around 09:00 US Eastern. Title, no adjectives, no exclamation:

> Show HN: Heliograph – a world map of sunlight

Then a first comment, from you, that is the real pitch. Something like:

> I wanted a sun map where the colour meant something. Every pixel here is
> shaded by the solar elevation at that latitude and longitude, through a
> spectral model built on the ASTM G-173 solar spectrum, IUP Bremen ozone cross
> sections and Rayleigh/Mie parameters, cross-checked against Apollo 17 and
> Blue Marble imagery. That is why snow goes pink at sunset while water goes
> straight to blue.
>
> A few things I did not expect going in. NOAA's own sunrise iteration is not a
> contraction above about 63 degrees of latitude — at 70 north it can be twelve
> minutes out, and iterating a third time makes it worse — so sunrise is found
> by scanning and bisecting instead. Eclipses fall out of the same two
> ephemerides as everything else, so the shadow is computed per pixel and
> totality comes out as a hundred-kilometre track rather than a hemisphere;
> it matches NASA's canon to about two minutes. And there is a mode that draws
> every time zone at the same reading of its own clock, which turns out to cost
> one shift of longitude, because the sun's hour angle at a place depends only
> on how far it sits from the meridian its clock keeps.
>
> No network at runtime: the map data, the terrain imagery and three typefaces
> are compiled in, and a service worker precaches the rest, so it runs offline.

**Reddit.** Different subreddits want different framings, and cross-posting the
same text to all of them reads as spam. Pick two or three:

- r/dataisbeautiful — needs an image or video post, not a bare link, and an
  "OC" flair with a source comment. The December-solstice local-noon view, with
  one sun glint per time zone, is the single most striking frame in the app.
- r/InternetIsBeautiful — a link post, plain description, no jargon.
- r/webgl, r/GraphicsProgramming — lead with the rendering: linear-light HDR
  compositing, tone mapping, and why only the glint and the brightest cities are
  allowed above 1.0.
- r/astronomy, r/space — lead with the ephemeris and the eclipse work.
- r/geography, r/MapPorn — lead with the time-zone mode.

**Elsewhere.** Lobsters (needs an invite, and the `graphics` or `javascript`
tag), Bluesky and Mastodon with the preview card, and Hacker Newsletter picks up
from HN on its own. If it does well on HN, the aggregators follow without you.

## What to lead with

The mistake would be to describe it as a sun map, because a hundred of those
exist. The things nobody else has:

1. The colour is derived rather than picked — a spectral model, not a gradient.
2. The land is real satellite imagery that changes with the season, from two
   Blue Marble composites blended on the solar declination.
3. Eclipses for a century, from geometry, with the shadow drawn per pixel.
4. Every time zone on one local clock.
5. It is offline-first and installs to a home screen.

## Already done, on the engineering side

- A 1200×630 preview card rendered from the real map, wired to Open Graph and
  Twitter cards, so the link unfurls with a picture everywhere it is posted.
  This is worth more than any other single item here: a bare link on HN or
  Slack with no card gets materially fewer clicks.
- A title and description written for a search result rather than for a tab.
- `robots.txt` and a sitemap.
- A service worker precaching the whole build, so a repeat visit is instant and
  a flaky connection still opens the map.
- Installable to a home screen, with icons.
- The whole app is about 2 MB, most of it the terrain imagery, and it renders
  at the full pixel density of the screen.

## Verifying the card before you post

Paste the URL into the debuggers and let them fetch it once, which also warms
their caches so the first real share is not the one that gets a blank box:

- https://cards-dev.twitter.com/validator
- https://developers.facebook.com/tools/debug/
- https://www.linkedin.com/post-inspector/
