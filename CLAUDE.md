# nyaarank

Search front-end for nyaa.si that ranks anime releases by **encode quality vs.
storage cost** instead of by upload date, which is all nyaa itself sorts by.

Origin: planned in a claude.ai chat on a phone. Nothing here has been compiled
or run against the live nyaa feed — see **Verification status** before trusting
anything.

---

## Why this exists

nyaa's search is a substring match. It cannot tell you which of forty results
for the same show is a good encode, and the two failure modes are opposite:
a 380 GB BD remux that eats the disk, or a 180 MB/ep re-encode that is mush.

The core insight the whole app is built on: **smaller is not better, there is a
sweet spot.** Ranking is therefore a band-fit problem, not a sort.

---

## Files

| File | Role |
|---|---|
| `index.html` | The whole app: parser, scorer, UI. Self-contained, no build step. |
| `.github/workflows/build-apk.yml` | Scaffolds an Android project around `index.html` and builds an APK in CI. |
| `nyaarank.py` | Desktop version — stdlib-only Python, serves a local web UI on :8420. Also `python3 nyaarank.py "query"` for CLI. |

`index.html` and `nyaarank.py` are independent ports of the same logic. **If you
change scoring, change both**, or delete the Python one.

---

## Scoring model

Ranking is the sum of five terms, capped to 0–100.

**1. Group reputation** (`GROUPS`, ~45 entries, tiers score −35 to +34)

| Tier | Meaning | Examples |
|---|---|---|
| archival | reference-grade, worth the disk | VCB-Studio, Vodes, sam, Kaleido, LYS1TH3A |
| great | very good, sensible sizes | GJM, MTBB, Beatrice-Raws, Reinforce |
| good | solid safe default | SubsPlease, Erai-raws, ASW |
| compact | small on purpose, quality fine not amazing | Ember, Judas, Anime Time |
| avoid | heavy-handed compression | AnimeRG, Pahe, Cleo, PSA |

This list is a snapshot of one person's read of the scene and **will go stale**.
It is a plain dict on purpose. Editing it is the intended way to tune the app.

**2. Size fit** (`TARGETS`, 0–30 pts) — the interesting part.

Per `(resolution, codec)`: `[ideal_lo, ideal_hi, tolerable_lo, tolerable_hi]` in
MB per episode. Full marks inside the ideal band, tapering **logarithmically**
to zero at the tolerable edges, zero outside. e.g. 1080p HEVC ideal is 250–780
MB/ep; 1080p AVC is 600–1600.

A "thrift" slider (0–1) shifts the whole band by `1 − (thrift − 0.5) × 0.9`,
so 1.45× wider for archivists, 0.55× for the storage-constrained. This visibly
reorders results, which is the point.

**3. Seeders** — `min(20, 7·log10(s+1))`, with −25 for a dead torrent.

**4. Flags** — trusted +8, 10-bit +5, remake −8, remux `−44 × thrift`,
FLAC −6 when thrifty, dual audio ±12 when requested.

**5. Resolution distance** from the target, penalised in both directions.

Every release also carries up to 3 human-readable reasons for its score. Keep
this. A score with no explanation is not trustworthy and users will not tune it.

---

## Parsing gotchas (both discovered the hard way — do not regress)

1. **Underscores break every regex.** Many groups separate tags with `_`
   (`[Ma10p_1080p][x265_flac]`, VCB-Studio and most CN/KR encoders). `_` is a
   word character, so `\b` never fires against it and every tag silently misses,
   falling through to defaults. Fix: normalise `_` → space before detection.
   Group extraction still uses the raw title.

2. **Season packs often carry no episode number at all** — just title and tags.
   Naive parsing reads a 48 GB pack as one 48 GB episode and buries it. Fix:
   if no episode marker was found and total size > 8 GB, assume a 12-episode
   cour and mark the count as a guess (the UI shows `batch ×12?`).

Episode ranges appear as `01-12`, `(01-28)`, `01~28`, `S01E01-E12`. Validate
`end > start` or `"Show 2 - 01"` parses as a range.

---

## Android build

`index.html` runs in a WebView from `assets/`. The APK exists for one reason:
**nyaa sends no CORS headers**, so a browser cannot fetch it and the web build
has to bounce through free public relays that break constantly. In the app,
`MainActivity.Bridge.fetch()` does the HTTP in Java, where CORS does not apply.

The bridge contract, which must match on both sides:

- JS calls `window.Nyaa.fetch(url, token)` and returns immediately
- Java fetches on a worker thread, then calls `window.__nyaaResolve(token, body)`
- Errors come back as a body starting with `ERROR:`
- JS sets `NATIVE = !!(window.Nyaa && window.Nyaa.fetch)` and falls back to the
  proxy chain in a plain browser

Async on purpose: `@JavascriptInterface` methods run on the JavaBridge thread,
so blocking there freezes the page and the spinner stops animating.

Also native: `shouldOverrideUrlLoading` fires an `ACTION_VIEW` intent so magnet
links hand off to a torrent app instead of the copy-paste dance.

Stack is deliberately minimal to reduce dependency-resolution risk: plain Java,
no Kotlin, no AndroidX, zero third-party deps. AGP 8.5.2 / Gradle 8.7 / JDK 17 /
compileSdk 34 / minSdk 26 (26 avoids needing PNG icon fallbacks). Debug-signed,
published to GitHub Releases because Actions artifacts arrive as a `.zip`, which
Android will not install.

---

## Verification status

Verified:
- Parser and scorer, both ports, against ~11 realistic release names
- Slider reordering (MTBB dual-audio BD wins at archivist; Ember HEVC at 227
  MB/ep wins at thrifty)
- Workflow YAML parses, all 10 heredocs balanced and unindented
- Generated Java braces balanced, XML well-formed, bridge names match
- Local server serves and fails gracefully

**Not verified:**
- **The Gradle build has never run.** Highest-risk item.
- No request has ever hit the live nyaa RSS feed. The sandbox that wrote this
  had no network access to nyaa.si and no Android SDK.
- The CORS proxy chain is unproven and those services die often.
- Group tiers are one person's opinion, not measured.

---

## Start here

1. **Run the Android build locally.** `assembleDebug` with the versions above.
   This is the one thing most likely to be broken and cannot be checked in CI
   without burning minutes on each guess.
2. **Hit the real feed** — `python3 nyaarank.py "frieren"` is the fastest path,
   no CORS involved. Check the parser against actual titles; the test set was
   invented and real nyaa titles are messier.
3. Then consider: caching, an AniList lookup to resolve title aliases (nyaa
   indexes whatever uploaders typed, so "Sousou no Frieren" and "Frieren" return
   different sets), and per-show overrides for the group list.
