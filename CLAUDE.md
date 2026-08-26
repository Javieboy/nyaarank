# nyaarank

Search front-end for nyaa.si that ranks anime releases by **encode quality vs.
storage cost** instead of by upload date, which is all nyaa itself sorts by.
Ships as an Android app that updates itself.

Status: built, installed, running against the live feed. Everything below has
been executed unless it says otherwise — see **Verification status**.

---

## Why this exists

nyaa's search is a substring match. It cannot tell you which of forty results
for the same show is a good encode, and the two failure modes are opposite:
a 380 GB BD remux that eats the disk, or a 180 MB/ep re-encode that is mush.

The core insight the whole app is built on: **smaller is not better, there is a
sweet spot.** Ranking is therefore a band-fit problem, not a sort.

TorBox extends that: ranking tells you what is *best*, not what you can
actually get. A release can score 95 and have two dead seeders. When TorBox has
it cached, the swarm stops mattering and the score changes to say so.

---

## Files

| File | Role |
|---|---|
| `index.html` | Shell markup: four screens and the tab bar. |
| `app.css` | All styles. Palette lives in `:root`. |
| `app.js` | Parser, scorer, TorBox client, UI. |
| `android/` | WebView host, native HTTP bridge, self-updater. |
| `tools-release.js` | Bump version, build, commit, push, publish. One command. |
| `tools-serve.js` | Dev server on :8420. |

`app.js` is the single source of truth. Gradle's `syncWebApp` copies the three
web files into `assets/` at build time and fails the build if one is missing,
so the packaged copies cannot drift from the ones you edit.

---

## Scoring model

Ranking is the sum of six terms, capped to 0–100.

**1. Group reputation** (`GROUPS`, ~47 entries, tiers score −35 to +34)

| Tier | Meaning | Examples |
|---|---|---|
| archival | reference-grade, worth the disk | VCB-Studio, Vodes, sam, Kaleido |
| great | very good, sensible sizes | GJM, MTBB, Beatrice-Raws, Reinforce |
| good | solid safe default | SubsPlease, Erai-raws, ASW |
| compact | small on purpose, quality fine not amazing | Ember, Judas, Anime Time |
| avoid | heavy-handed compression | AnimeRG, Pahe, Cleo, PSA |

A snapshot of one person's read of the scene; it **will go stale**. It is a
plain dict on purpose — editing it is the intended way to tune the app. Real
searches routinely surface good encoders that are not in it (`tlacatlc6`,
`anime4life.`, `Ironclad`, `DKB`, `ToonsHub`), and they land as `unknown` (+6).

**2. Size fit** (`TARGETS`, 0–30 pts) — the interesting part.

Per `(resolution, codec)`: `[ideal_lo, ideal_hi, tolerable_lo, tolerable_hi]` in
MB per episode. Full marks inside the ideal band, tapering **logarithmically**
to zero at the tolerable edges, zero outside. 1080p HEVC ideal is 250–780 MB/ep;
1080p AVC is 600–1600.

A "thrift" slider (0–1) shifts the band by `1 − (thrift − 0.5) × 0.9`: 1.45×
wider at the archivist end (`thrift 0`), 0.55× at the storage-constrained end
(`thrift 1`). Note the direction — it is easy to read backwards.

**3. Seeders** — `min(20, 7·log10(s+1))`, with −25 for a dead torrent.
**Skipped entirely when TorBox has the torrent cached**, which then scores a
flat +20. A cached 2-seeder release gains roughly 17 points and can outrank a
healthy one. This is deliberate and is the whole point of the integration.

**4. Flags** — trusted +8, 10-bit +5, remake −8, remux `−44 × thrift`,
FLAC −6 when thrifty, dual audio ±12 when requested.

**5. Resolution distance** from the target, penalised in both directions.

**6. Plan cap** — not scored, but anything larger than the TorBox per-download
limit is marked un-sendable in the UI.

Every release carries up to 3 human-readable reasons. Keep this. A score with
no explanation is not trustworthy, and it matters *more* now that a dead
torrent can rank highly — without the reason line that looks like a bug.

---

## Parsing gotchas (do not regress)

1. **Underscores break every regex.** Many groups separate tags with `_`
   (`[Ma10p_1080p][x265_flac]`, VCB-Studio and most CN/KR encoders). `_` is a
   word character, so `\b` never fires and every tag silently misses. Fix:
   normalise `_` → space before detection. Group extraction uses the raw title.

2. **Season packs often carry no episode number.** Naive parsing reads a 48 GB
   pack as one 48 GB episode. Fix: if no episode marker was found and total
   size > 8 GB, assume a 12-episode cour and mark it a guess (`batch ×12?`).

3. **An explicit episode marker must beat season-pack wording.** Found against
   the live feed, and it was severe: `[SubsPlease] Sousou no Frieren S2 - 10`
   matched the season-pack regex on `S2`, and `[EMBER] ... S02E09 ... Season 2`
   matched the batch regex on the words "Season 2". Both are single episodes.
   Every weekly release was being divided by 12, reading as an impossibly small
   encode, and sinking. `R.epExplicit` is checked before the batch branch.

4. **Scene releases put the group last** — `...H 264-VARYG (Sousou no Frieren,
   Multi-Audio)`. `groupTail` allows trailing parentheticals and requires a
   leading letter, so `- 10 (1080p)` is not read as a group named "10".

Episode ranges appear as `01-12`, `(01-28)`, `01~28`, `S01E01-E12`.

---

## The network, which is hostile here

Tested on Biznet home broadband and an Indonesian 4G carrier.

- **nyaa.si is DNS-blocked.** Biznet answers with a poisoned A record
  (`rpz.biznet`, 202.169.44.80); the mobile carrier answers `::1`. Two
  different shapes, so catching only `UnknownHostException` is not enough.
- **api.torbox.app was NXDOMAIN on the carrier** at one point, reachable later.
- **DoH fixes the lookup.** The bridge falls back to `https://1.1.1.1/dns-query`
  addressed by literal IP — Cloudflare's certificate covers the bare address, so
  no bootstrap lookup is needed — then reconnects to the real IP with the true
  hostname in SNI, the Host header, and explicit SAN verification.
- **The by-IP request must not go through HttpsURLConnection.** This looked for
  a long time like a certificate problem: connecting to `https://<ip>/` failed
  with `CertPathValidatorException: trust anchor for certification path not
  found`, and nyaa.si does chain through ISRG Root YR, a 2025 Let's Encrypt
  root. Bundling that root changed nothing.

  A handshake-only probe settled it: **a raw TLS handshake to the same IP
  succeeds on the platform's own trust**, no bundled roots involved. The device
  trusts the chain. What fails is HttpsURLConnection validating the certificate
  against the URL's host, which for a by-IP request is a literal address — it
  rejects the chain and misreports it as a missing anchor.

  So `httpOverTls()` speaks HTTP/1.1 over the SSLSocket directly for the by-IP
  path. `Connection: close` makes the body readable to EOF, so no chunked
  decoding, and no `Accept-Encoding` is sent so nothing arrives compressed.

  Search now works with no VPN.

The two ISRG roots in `res/raw` are kept for a device that genuinely lacks them,
but they were not the fix. The lesson worth keeping: the error message named a
cause that was not the cause, and three rounds of plausible reasoning went the
wrong way. One probe that separated "handshake" from "HTTP request" answered it
immediately.

---

## Android

`index.html` runs in a WebView from `assets/`. The APK exists because **nyaa
sends no CORS headers** and **TorBox only allows `https://torbox.app` as an
origin** — a browser build genuinely cannot reach either.

Bridge, in `MainActivity.java`:

```
Nyaa.request(specJson, token)   {method, url, headers, body:{kind,data}}
  -> window.__nyaaResolve(token, payload)
     payload = JSON {status, body} for ANY http reply, 4xx included
     payload = "ERROR:<msg>" only for transport failure
```

Non-2xx is data, not failure: TorBox answers **HTTP 400** for "device code not
used yet" during sign-in. Body kinds: `json`, `form`, `multipart`, `raw` —
`createtorrent` needs multipart.

Also native: `getKey`/`setKey` (SharedPreferences, not localStorage — app
private, though not encrypted; `EncryptedSharedPreferences` would pull in
AndroidX), `openUrl`, `download` (DownloadManager), `appVersion`,
`installUpdate`, `diagnose`.

**Never log a URL.** `requestdl` carries the API token in the query string.
`describe()` strips any message containing `://` for this reason.

Async on purpose: `@JavascriptInterface` methods run on the JavaBridge thread,
so blocking there freezes the page.

Edge to edge: the app draws behind both system bars with them transparent, so
the gesture pill sits over the app's own background. The layout clears them with
`env(safe-area-inset-*)`, which only reports real values in this mode.

Stack stays minimal: plain Java, no Kotlin, no AndroidX, zero third-party deps.
AGP 8.5.2 / Gradle 8.7 / JDK 17 / compileSdk 34 / minSdk 26.

**Signing:** debug-signed with this machine's keystore. Android only accepts an
update signed with the same key, so releases must keep coming from here.
Building elsewhere means uninstall-then-reinstall.

---

## Self-update

`node tools-release.js` bumps `versionCode`, builds, commits, pushes, and
publishes to GitHub Releases as tag `v<versionCode>` with the APK attached. The
app compares its own `versionCode` against that tag, so there is no version
string to parse.

The repo is public deliberately: private release assets need an Authorization
header, and the only way to give the app one is to ship a token inside the APK.

**The check reads `releases.atom`, not the API.** Unauthenticated
`api.github.com` allows 60 requests an hour **per IP**, and an ISP that NATs
its customers shares one address between thousands of them — so Check for
updates returned HTTP 403 on a phone that had never called GitHub itself.
Measured, not inferred: `/rate_limit` reported 0 of 60 remaining for an address
that had made no requests of its own. `releases.atom` is served by the web host
under no such quota, and since `tools-release.js` always names the asset
`nyaarank-v<code>.apk`, the download URL follows from the tag. The API remains
the fallback — it is the only source for the asset's exact size — and its
non-200 body is now shown, because "GitHub returned HTTP 403" reads as a
permission problem and sent debugging the wrong way for an hour.

**Do not rename the release asset** without changing `parseReleasesAtom`. A
HEAD request guards the derived URL, so a rename degrades to the API path
rather than handing DownloadManager a 404 page to install — but that path is
the rate-limited one.

---

## TorBox

Base `https://api.torbox.app/v1/api`. Envelope is
`{success, error, detail, data}`; the docs say `detail` is safe to show users
verbatim, and it is used that way.

**Sign-in is the device-code flow**, not an API key:

```
GET  /user/auth/device/start?app=nyaarank
  -> data {code, device_code, interval, expires_at,
           verification_url, friendly_verification_url}
POST /user/auth/device/token  {device_code}
  -> HTTP 400 + error DEVICE_CODE_NOT_USED while pending
```

The user must already be signed in to torbox.app in the browser, or the
approval page's Continue button silently does nothing.

**`/user/me` really returns** (observed): `id`, `plan` (integer, 0 = free),
`created_at`, `premium_expires_at`, `cooldown_until`, `email`, `base_email`,
`total_bytes_downloaded`, `total_bytes_uploaded`, `torrents_downloaded`,
`is_subscribed`, `additional_concurrent_slots`, `long_term_seeding`,
`long_term_storage`, `user_referral`.

There is **no bandwidth-limit field** — only lifetime totals, so there is no
denominator for a usage bar. The number that constrains you is the per-download
cap, which comes from the plan and is documented rather than returned:
Free 10 GiB, Essential 200 GiB, Standard 200 GiB, Pro 500 GiB.

**The API is partly paid-only.** `PLAN_RESTRICTED_FEATURE` is returned per
endpoint, not globally: `checkcached` works on a free account, `mylist` does
not. Track the gate per endpoint — assuming it is global switches off features
that demonstrably work.

**Rate limits shape the design.** `createtorrent` is 60/hour for uncached items
but 300/min for cached ones, so always check cached first and never add blind.
`add_only_if_cached=true` cannot burn the hourly quota.

Response shapes for `checkcached`, `mylist`, `requestdl` and `controltorrent`
are **not** in the OpenAPI spec — every `responses.200` is empty — and CORS
prevents testing them from a browser. The parsers accept several plausible
shapes. Treat them as unverified.

---

## Verification status

Verified by execution:
- Parser and scorer against **75 live nyaa releases**, not invented names
- The refactor from one file to three, by diffing scorer output before/after
- Gradle build, APK contents, manifest, install on device
- Device-code sign-in end to end, and the real `/user/me`
- `checkcached` returning hits on a free account, badges and re-ranking
- Self-update: detect, download, install, and the version comparison
- DoH + SNI + SAN verification, as a standalone Java program, against the
  DNS-poisoned host

**Not verified:**
- `requestdl` and `controltorrent` beyond a single successful call each
- Whether the cached lookup slows a search perceptibly
- `/stream/createstream` — gated above the Essential plan

---

## Start here

1. **Use it.** Every worthwhile fix so far came from real searches, not from
   planning: the S2-10 parser bug, episodes sorting by size, unreadable file
   names, the dead Send button. None were predicted.
2. **Add the encoders that keep coming back `unknown`** — tlacatlc6,
   anime4life., Ironclad, DKB, ToonsHub, Anipakku, Salieri, kikuri, neoDESU.
   `GROUPS` is the biggest single lever on ranking quality.
3. Consider: `/stream/createstream` for playback instead of downloading,
   caching search results, an AniList lookup for title aliases (nyaa indexes
   whatever uploaders typed), and per-show group overrides.
