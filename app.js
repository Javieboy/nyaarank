"use strict";

/* ============================================================
   GROUP REPUTATION — edit freely, groups rise and fall
   ============================================================ */
const GROUPS = {
  // archival: reference-grade, worth the disk
  "vodes":["archival","reference BD encodes"],
  "sam":["archival","reference BD encodes"],
  "lys1th3a":["archival","reference BD encodes"],
  "kaleido-subs":["archival","excellent subs + encode"],
  "kaleido":["archival","excellent subs + encode"],
  "vcb-studio":["archival","x265 BD, best quality-per-GB there is"],
  "moozzi2":["archival","high-grade BD, on the large side"],
  "sakurato":["archival","efficient x265 BD"],
  "zr":["archival","clean BD archival muxes"],
  "arid":["archival","careful BD encodes"],
  "nii-chan":["archival","good BD encodes"],
  "yurasuka":["archival","BD encodes"],
  // great
  "gjm":["great","top-tier subs and typesetting"],
  "mtbb":["great","excellent subs, sane encodes"],
  "jysze":["great","dual audio BD muxes"],
  "legion":["great","solid BD encodes"],
  "reaktor":["great","solid BD encodes"],
  "commie":["great","long-running fansub group"],
  "beatrice-raws":["great","high quality BD, raws only"],
  "reinforce":["great","high quality BD, raws only"],
  "sakura circle":["great","BD, often OVA rescues"],
  "trix":["great","dual audio, good muxes"],
  // good
  "subsplease":["good","straight CR/HIDIVE rip, no re-encode, safe default"],
  "erai-raws":["good","WEB mux with many sub tracks"],
  "asw":["good","WEB re-encode, decent and smaller"],
  "yameii":["good","dual audio WEB rips"],
  "tenrai-sensei":["good","WEB, reasonable sizes"],
  "ani":["good","fast WEB rips, subs often zh"],
  "nanashi":["good","WEB/BD muxes"],
  "smol":["good","compact WEB encodes"],
  "kitsune":["good","WEB rips"],
  "coalgirls":["good","older BD archives, big files"],
  "doki":["good","older fansub group"],
  "fff":["good","older fansub group"],
  // compact: small on purpose, quality fine not amazing
  "ember":["compact","HEVC WEB re-encode, very storage friendly"],
  "judas":["compact","HEVC re-encode, small, acceptable quality"],
  "cerberus":["compact","small HEVC re-encodes"],
  "anime time":["compact","small HEVC re-encodes"],
  "varyg":["compact","HEVC re-encodes"],
  "softberry":["compact","HEVC re-encodes"],
  "yuzu":["compact","small encodes"],
  // avoid
  "animerg":["avoid","aggressive compression, frequent artefacts"],
  "pahe":["avoid","extreme compression"],
  "pahe.in":["avoid","extreme compression"],
  "cleo":["avoid","heavy compression"],
  "psa":["avoid","heavy compression"],
  "mr.deadpool":["avoid","heavy compression"]
};
const TIER_SCORE = {archival:34,great:28,good:20,compact:14,raw:8,avoid:-35,unknown:6};

/* MB per episode: [ideal_lo, ideal_hi, tolerable_lo, tolerable_hi] */
const TARGETS = {
  "2160p|av1":[600,1800,300,4000], "2160p|hevc":[900,2600,400,6000], "2160p|avc":[2000,5000,1000,12000],
  "1080p|av1":[170,600,80,1400],   "1080p|hevc":[250,780,130,1800],  "1080p|avc":[600,1600,320,3000],
  "720p|av1":[80,260,40,600],      "720p|hevc":[120,380,60,800],     "720p|avc":[280,750,150,1400],
  "480p|hevc":[50,150,25,320],     "480p|avc":[100,300,50,600]
};

/* ============================================================
   RELEASE NAME PARSING
   ============================================================ */
const R = {
  group:/^\s*[\[\(]([^\]\)]{1,40})[\]\)]/,
  // Scene releases end "-VARYG" but often carry a trailing parenthetical:
  // "...H 264-VARYG (Sousou no Frieren, Multi-Audio)". Allow those, and
  // require a leading letter so "- 10 (1080p)" is not read as a group.
  groupTail:/-\s*([A-Za-z][A-Za-z0-9_]{1,19})\s*(?:[\[\(][^\]\)]*[\]\)]\s*)*$/,
  // Explicit single-episode marker: S02E10, S2 - 10, S02.E10
  epExplicit:/\bS\d{1,2}[\s._-]?E[\s._-]?\d{1,3}\b|\bS\d{1,2}\s*[-–]\s*\d{1,3}(?=$|[\s\]\)\[\(])/i,
  res:/\b(2160p|1440p|1080p|900p|720p|576p|480p|360p)\b/i,
  resWH:/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/,
  uhd:/\b(4k|uhd)\b/i,
  hevc:/\b(x\.?265|h\.?\s?265|hevc)\b/i,
  avc:/\b(x\.?264|h\.?\s?264|avc)\b/i,
  av1:/\bav1\b/i,
  tenbit:/\b(10\s?-?\s?bits?|hi10p?|yuv420p10)\b/i,
  remux:/\b(remux|bdmv|\.iso|untouched|full\s?bd)\b/i,
  bd:/\b(bd(rip|mv)?|blu-?\s?ray|bluray)\b/i,
  web:/\b(web-?dl|web-?rip|web|amzn|cr|hidive|nf|dsnp|b-?global)\b/i,
  tv:/\b(hdtv|tvrip|dvd(rip)?)\b/i,
  dual:/\b(dual[\s\-.]?audio|multi[\s\-.]?audio)\b/i,
  flac:/\bflac\b/i,
  multisub:/\b(multi[\s\-.]?subs?|multiple\s+subtitle)\b/i,
  batch:/\b(batch|complete|full\s?season|seasons?\s?\d)\b/i,
  range:/(?:^|[\s\[\(~])(?:S\d{1,2}\s?E)?(\d{1,3})\s*(?:-|~|to)\s*(?:S\d{1,2}\s?E)?(\d{1,3})(?:v\d)?(?=$|[\s\]\)])/gi,
  single:/(?:^|[\s\-\[\(])(?:S\d{1,2}\s?)?E?P?\s?(\d{1,3})(?:v\d)?(?=$|[\s\]\)])/i,
  seasonPack:/\bS(\d{1,2})\b(?!\s?E)/i,
  size:/([\d.]+)\s*(TiB|GiB|MiB|KiB|TB|GB|MB|KB)/i
};
const UNITS={kib:1/1024,mib:1,gib:1024,tib:1048576,kb:1/1024,mb:1,gb:1024,tb:1048576};

function sizeMB(t){
  const m = R.size.exec(t||""); 
  return m ? parseFloat(m[1]) * UNITS[m[2].toLowerCase()] : 0;
}
function detectGroup(t){
  let m = R.group.exec(t);
  if(m){
    const n = m[1].trim();
    if(!/^[0-9A-Fa-f]{8}$/.test(n) && !/^\d{4}$/.test(n) && !R.res.test(n)) return n;
  }
  m = R.groupTail.exec(t);
  return m ? m[1].trim() : "";
}
function groupTier(g){
  const k = g.toLowerCase().trim();
  if(GROUPS[k]) return GROUPS[k];
  for(const key in GROUPS){
    if(k.startsWith(key) || k.split(/\s+/).includes(key)) return GROUPS[key];
  }
  return ["unknown",""];
}
function detectRes(t){
  let m = R.res.exec(t); if(m) return m[1].toLowerCase();
  m = R.resWH.exec(t);
  if(m){ const h=+m[2];
    if(h>=2000)return"2160p"; if(h>=1000)return"1080p"; if(h>=680)return"720p"; if(h>=400)return"480p"; }
  return R.uhd.test(t) ? "2160p" : "";
}
function detectCodec(t){
  if(R.av1.test(t)) return "av1";
  if(R.hevc.test(t)) return "hevc";
  if(R.avc.test(t)) return "avc";
  return "";
}
function detectSource(t){
  if(R.remux.test(t)) return "remux";
  if(R.bd.test(t)) return "bd";
  if(R.web.test(t)) return "web";
  if(R.tv.test(t)) return "tv";
  return "";
}
function detectEpisodes(t){
  let best = null, m;
  R.range.lastIndex = 0;
  while((m = R.range.exec(t)) !== null){
    const a = +m[1], b = +m[2];
    if(b > a && (b-a) < 400 && b < 500){
      const span = b - a + 1;
      if(best === null || span > best) best = span;
    }
  }
  if(best) return [best, true, "exact"];

  // An explicit episode marker beats season-pack wording. Found against the
  // live feed: "[SubsPlease] Sousou no Frieren S2 - 10" and "[EMBER] Frieren
  // ... S02E09 ... Season 2" are single episodes whose titles also name the
  // season, and were being read as 12-episode batches — dividing a 500 MB
  // episode by 12 and burying every weekly release. Ranges are matched above,
  // so anything reaching here with SxxExx is a single.
  if(R.epExplicit.test(t)) return [1, false, "exact"];

  if(R.batch.test(t) || R.seasonPack.test(t)) return [12, true, "guess"];
  if(R.single.test(t)) return [1, false, "exact"];
  return [1, false, "assumed"];
}
function parseRelease(title){
  // Many groups separate tags with underscores: [Ma10p_1080p][x265_flac].
  // "_" is a word char so \b never fires against it — normalise first.
  const n = title.replace(/_/g, " ");
  const group = detectGroup(title);
  const [tier, note] = groupTier(group);
  const res = detectRes(n);
  let codec = detectCodec(n);
  const [eps, isBatch, epConf] = detectEpisodes(n);
  if(!codec) codec = (tier === "compact") ? "hevc" : "avc";
  return {
    group, tier, note,
    resolution: res || "1080p", resKnown: !!res,
    codec, source: detectSource(n),
    season: parseSeason(title),
    episodes: eps, isBatch, epConf,
    tenBit: R.tenbit.test(n) || /ma10p/i.test(n),
    dual: R.dual.test(n), flac: R.flac.test(n),
    multiSub: R.multisub.test(n), remux: R.remux.test(n)
  };
}

/* ============================================================
   SCORING
   ============================================================ */
function targets(res, codec, thrift){
  const t = TARGETS[res+"|"+codec] || TARGETS["1080p|avc"];
  const shift = 1 - (thrift - .5) * .9;   // 1.45x for archivists, .55x for misers
  return [t[0]*shift, t[1]*shift, t[2]*shift*.85, t[3]*shift];
}
function fitScore(mbEp, res, codec, thrift){
  const band = targets(res, codec, thrift);
  const [lo,hi,tlo,thi] = band;
  if(mbEp <= 0) return [.35, band];
  if(mbEp >= lo && mbEp <= hi) return [1, band];
  const L = Math.log;
  if(mbEp < lo) return [mbEp <= tlo ? 0 : (L(mbEp)-L(tlo))/(L(lo)-L(tlo)), band];
  return [mbEp >= thi ? 0 : (L(thi)-L(mbEp))/(L(thi)-L(hi)), band];
}
function scoreItem(it, o){
  const p = it.parsed;
  // Season packs often carry no episode number at all. A single episode is
  // never 8 GB, so infer a cour from total size.
  if(p.epConf === "assumed" && it.sizeMB > 8000){
    p.episodes = 12; p.isBatch = true; p.epConf = "guess";
  }
  const eps = Math.max(1, p.episodes);
  const mbEp = it.sizeMB / eps;
  it.mbEp = mbEp;

  const why = [];
  let s = TIER_SCORE[p.tier];
  if(p.tier === "archival") why.push(["good", p.group + " — " + p.note]);
  else if(p.tier === "avoid") why.push(["bad", p.group + " — " + p.note]);
  else if(p.tier === "compact") why.push(["ok", p.group + " — " + p.note]);
  else if(p.tier === "unknown" && p.group) why.push(["ok", p.group + " isn't in the reputation list"]);

  const [fit, band] = fitScore(mbEp, p.resolution, p.codec, o.thrift);
  it.band = band; it.fit = fit;
  s += fit * 30;
  if(fit >= .95) why.push(["good", fmtMB(mbEp) + "/ep is right in the " + p.codec.toUpperCase() + " sweet spot"]);
  else if(mbEp > band[1] && fit < .6) why.push(["bad", fmtMB(mbEp) + "/ep — heavy for what you get"]);
  else if(mbEp < band[0] && fit < .6) why.push(["bad", "only " + fmtMB(mbEp) + "/ep — artefacts likely"]);

  // Seeders only matter if you are the one downloading the swarm. When
  // TorBox already has the torrent cached it serves from its own CDN, so a
  // dead swarm costs nothing — score it as if it were healthy. This is the
  // whole reason the integration exists: it makes a great encode with two
  // seeders actually obtainable.
  if(it.cached){
    s += 20;
    why.push(["good","TorBox has this cached — instant, seeders don't matter"]);
  }else{
    s += Math.min(20, 7 * Math.log10(it.seeders + 1));
    if(it.seeders === 0){ s -= 25; why.push(["bad","dead — zero seeders"]); }
    else if(it.seeders < 3) why.push(["bad", "only " + it.seeders + " seeder(s), expect a crawl"]);
  }

  if(it.trusted){ s += 8; why.push(["good","trusted uploader"]); }
  if(it.remake){ s -= 8; }
  if(p.remux){ s -= 44 * o.thrift; why.push(["bad","remux / untouched BD — the disk killer"]); }
  if(p.tenBit){ s += 5; }
  if(p.flac && o.thrift > .6){ s -= 6; why.push(["ok","FLAC adds size you probably won't hear"]); }
  if(p.dual){ if(o.dual){ s += 12; why.push(["good","dual audio"]); } else s += 2; }
  else if(o.dual){ s -= 14; why.push(["bad","no dual audio track"]); }
  if(p.multiSub) s += 3;

  const ord = ["480p","720p","1080p","2160p"];
  const gap = ord.indexOf(p.resolution) - ord.indexOf(o.res);
  if(gap < 0){ s -= 10 * Math.abs(gap); why.push(["bad", p.resolution + ", below the " + o.res + " you asked for"]); }
  else if(gap > 0){ s -= 5 * gap; why.push(["ok", p.resolution + " — more bytes than you asked for"]); }

  if(p.isBatch){
    s += 4;
    if(p.epConf === "guess") why.push(["ok","episode count guessed from the name — size/ep is an estimate"]);
  }
  it.score = Math.round(Math.max(0, Math.min(100, s)) * 10) / 10;
  it.why = why.slice(0, 3);
  return it;
}

/* ============================================================
   FETCH — nyaa sends no CORS headers, so relay through a proxy.
   Several, because free proxies die constantly.
   ============================================================ */
const PROXIES = [
  u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  u => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  u => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  u => "https://thingproxy.freeboard.io/fetch/" + u
];
const TRACKERS = [
  "http://nyaa.tracker.wf:7777/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.torrent.eu.org:451/announce"
];
function magnetOf(hash, name){
  if(!hash) return "";
  return "magnet:?xt=urn:btih:" + hash + "&dn=" + encodeURIComponent(name)
       + TRACKERS.map(t => "&tr=" + encodeURIComponent(t)).join("");
}
function pick(item, local){
  for(const c of item.children){
    const ln = c.localName || c.nodeName.replace(/^.*:/, "");
    if(ln === local) return (c.textContent || "").trim();
  }
  return "";
}
function parseFeed(text){
  if(text.indexOf("<item") === -1) return null;
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const items = [...doc.getElementsByTagName("item")];
  if(!items.length) return null;
  return items.map(el => {
    const title = pick(el, "title");
    const hash = pick(el, "infoHash");
    const sizeText = pick(el, "size");
    return {
      title, page: pick(el, "guid"), link: pick(el, "link"),
      hash: hash.toLowerCase(),          // needed for the TorBox cached lookup
      magnet: magnetOf(hash, title),
      sizeText, sizeMB: sizeMB(sizeText),
      seeders: +pick(el, "seeders") || 0,
      leechers: +pick(el, "leechers") || 0,
      trusted: pick(el, "trusted").toLowerCase() === "yes",
      remake: pick(el, "remake").toLowerCase() === "yes",
      parsed: parseRelease(title)
    };
  }).filter(x => x.title);
}

/* ---- native bridge -------------------------------------------------
   In the Android build all HTTP happens in Java, where CORS does not
   apply, so the proxy chain is skipped entirely. In a plain browser
   NATIVE is false and nothing here runs.

   Contract, which must match MainActivity.java:

     Nyaa.request(specJson, token)
       spec = {method, url, headers:{}, body:{kind,data}}
       -> window.__nyaaResolve(token, payload)

     payload is JSON {status, body} for ANY http reply, 4xx included —
     TorBox answers 400 for "device code not used yet", so a non-2xx
     status is data, not a failure. Only transport errors arrive as a
     string starting with "ERROR:".
   -------------------------------------------------------------------- */
const NATIVE = !!(window.Nyaa && window.Nyaa.request);
const PENDING = {};
let TOKEN = 0;

window.__nyaaResolve = function(token, payload){
  const p = PENDING[token];
  if(!p) return;                    // already timed out, or a stale reply
  delete PENDING[token];
  clearTimeout(p.timer);
  if(typeof payload === "string" && payload.slice(0, 6) === "ERROR:"){
    p.reject(new Error(payload.slice(6)));
    return;
  }
  try{
    p.resolve(JSON.parse(payload));
  }catch(e){
    p.reject(new Error("bridge returned malformed payload"));
  }
};

/* Resolves {status, body}. Rejects only on transport failure or timeout. */
function nativeRequest(spec, timeoutMs){
  return new Promise((resolve, reject) => {
    const token = "t" + (++TOKEN);
    const timer = setTimeout(() => {
      delete PENDING[token];
      reject(new Error("native request timed out"));
      // Safety net only — Java enforces the real limits. It must sit
      // ABOVE the worst case there (direct fail + DoH + by-IP retry) or a
      // request that is still succeeding gets abandoned from this side.
    }, timeoutMs || 75000);
    PENDING[token] = {resolve, reject, timer};
    try{
      window.Nyaa.request(JSON.stringify(spec), token);
    }catch(e){
      delete PENDING[token];
      clearTimeout(timer);
      reject(e);
    }
  });
}

async function fetchNyaa(query, cat, filt){
  const target = "https://nyaa.si/?page=rss&q=" + encodeURIComponent(query)
    + "&c=" + cat + "&f=" + filt + "&s=seeders&o=desc";

  if(NATIVE){
    const r = await nativeRequest({method:"GET", url:target});
    if(r.status !== 200) throw new Error("nyaa returned HTTP " + r.status);
    const items = parseFeed(r.body);
    if(!items) throw new Error("nyaa returned no RSS items");
    return items;
  }

  let lastErr = "no proxy responded";
  for(const wrap of PROXIES){
    try{
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(wrap(target), {signal: ctl.signal});
      clearTimeout(to);
      if(!r.ok){ lastErr = "proxy returned HTTP " + r.status; continue; }
      const items = parseFeed(await r.text());
      if(!items){ lastErr = "proxy returned no RSS items"; continue; }
      return items;
    }catch(e){ lastErr = e.name === "AbortError" ? "proxy timed out" : String(e.message || e); }
  }
  throw new Error(lastErr);
}

/* ============================================================
   UI
   ============================================================ */
const $ = s => document.querySelector(s);
const out = $("#out");
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtMB = mb => mb >= 1024 ? (mb/1024).toFixed(mb >= 10240 ? 0 : 1) + " GB" : Math.round(mb) + " MB";

const opts = {thrift:.6, res:"1080p", dual:false, trusted:false};
const WORDS = [[.15,"archivist"],[.4,"roomy"],[.66,"balanced"],[.86,"lean"],[2,"every byte"]];
const word = v => (WORDS.find(w => v < w[0]) || WORDS[4])[1];

function syncLabel(){ $("#fnow").textContent = word(opts.thrift) + " · " + opts.res; }

$("#ftog").onclick = function(){
  const open = this.getAttribute("aria-expanded") === "true";
  this.setAttribute("aria-expanded", String(!open));
  $("#filters").classList.toggle("open", !open);
};
$("#thrift").oninput = e => { opts.thrift = +e.target.value / 100; syncLabel(); };
$("#segres").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  [...e.currentTarget.children].forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  opts.res = b.dataset.v; syncLabel();
};
$("#segopt").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  const on = b.getAttribute("aria-pressed") !== "true";
  b.setAttribute("aria-pressed", String(on));
  opts[b.dataset.k] = on;
};
syncLabel();

const LMIN = Math.log(40), LMAX = Math.log(9000);
const pos = mb => Math.max(0, Math.min(100, (Math.log(Math.max(mb,40)) - LMIN) / (LMAX - LMIN) * 100));

function meter(it){
  const [lo,hi] = it.band, mb = it.mbEp;
  const inBand = mb >= lo && mb <= hi;
  const bad = mb > hi*1.7 || mb < lo*.55;
  const cls = inBand ? "good" : bad ? "bad" : "";
  const vtxt = inBand ? "sweet spot" : (mb > hi ? "storage hog" : "over-compressed");
  const vcls = inBand ? "v-good" : bad ? "v-bad" : "v-mid";
  return `<div class="meter">
    <div class="mtop">
      <span class="perep">${fmtMB(mb)} <small>/ ep</small></span>
      <span class="verdict ${vcls}">${vtxt}</span>
    </div>
    <div class="track">
      <div class="sweet" style="left:${pos(lo)}%;width:${Math.max(pos(hi)-pos(lo),2)}%"></div>
      <div class="pin ${cls}" style="left:${pos(mb)}%"></div>
    </div>
    <div class="mscale"><span>40 MB</span><span>ideal ${fmtMB(lo)}–${fmtMB(hi)}</span><span>9 GB</span></div>
  </div>`;
}

function tagsOf(it){
  const p = it.parsed, T = [];
  T.push(`<span class="tag k">${esc(p.resolution)}${p.resKnown?"":"?"}</span>`);
  T.push(`<span class="tag k">${esc(p.codec.toUpperCase())}</span>`);
  if(p.tenBit) T.push(`<span class="tag teal">10-bit</span>`);
  if(p.source) T.push(`<span class="tag ${p.source==="remux"?"red":"k"}">${esc(p.source.toUpperCase())}</span>`);
  if(p.dual) T.push(`<span class="tag teal">dual audio</span>`);
  if(p.flac) T.push(`<span class="tag">FLAC</span>`);
  if(p.multiSub) T.push(`<span class="tag">multi-sub</span>`);
  T.push(`<span class="tag k">${esc(it.sizeText)}</span>`);
  if(p.isBatch) T.push(`<span class="tag gold">batch ×${p.episodes}${p.epConf==="guess"?"?":""}</span>`);
  if(it.trusted) T.push(`<span class="tag teal">trusted</span>`);
  return T.join("");
}

let RESULTS = [];
let SEASON_NOTE = "";   // e.g. " · S1", shown next to the result count

function render(items, q){
  $("#scr-search").classList.remove("home");
  RESULTS = items;
  $("#hcount").textContent = items.length ? items.length + " ranked" + SEASON_NOTE : "";
  if(!items.length){
    out.innerHTML = `<div class="status">Nothing for “${esc(q)}”.<br><br>
      Try the romaji title — nyaa indexes what uploaders typed, so
      “Sousou no Frieren” finds more than “Frieren”.</div>`;
    return;
  }
  // A season was asked for and nothing matched: say so rather than showing
  // another season's results as though they were what was wanted.
  const missed = / · no S(\d+)/.exec(SEASON_NOTE);
  const banner = missed
    ? `<div class="status" style="padding:14px 4px 4px">Nothing on nyaa's first
       75 results is season ${missed[1]}. Showing everything else — the seasons
       actually found are
       ${[...new Set(items.map(i => "S" + i.parsed.season))].sort().join(", ")}.</div>`
    : "";
  out.innerHTML = banner + items.map((it, i) => {
    const sc = it.score >= 70 ? "s-hi" : it.score >= 45 ? "s-mid" : "s-lo";
    const why = it.why.map(w => `<li class="${w[0]}">${esc(w[1])}</li>`).join("");
    return `<div class="card">
      <div class="chead">
        <div class="score ${sc}">${Math.round(it.score)}</div>
        <div class="grp">${esc(it.parsed.group || "no group tag")}</div>
        <div class="tier ${it.parsed.tier}">${it.parsed.tier}</div>
      </div>
      <div class="name" onclick="this.classList.toggle('full')">${esc(it.title)}</div>
      <div class="tags">${tagsOf(it)}</div>
      ${meter(it)}
      <ul class="why">${why}</ul>
      ${tbAction(it, i)}
      <div class="acts">
        <button class="btn pri" data-copy="${i}">Copy magnet</button>
        <a class="btn" href="${esc(it.magnet)}">Open</a>
        <span class="peers"><b>${it.seeders}</b>seed</span>
      </div>
      <div class="magbox" id="mag${i}">${esc(it.magnet)}</div>
    </div>`;
  }).join("");
}

out.addEventListener("click", async e => {
  const b = e.target.closest("[data-copy]"); if(!b) return;
  const i = +b.dataset.copy, mag = RESULTS[i].magnet;
  let ok = false;
  try{ await navigator.clipboard.writeText(mag); ok = true; }
  catch(_){
    try{
      const ta = document.createElement("textarea");
      ta.value = mag; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand("copy"); ta.remove();
    }catch(__){ ok = false; }
  }
  if(ok){
    b.textContent = "Copied ✓"; b.classList.add("done");
    setTimeout(() => { b.textContent = "Copy magnet"; b.classList.remove("done"); }, 1600);
  }else{
    // clipboard blocked in this frame — reveal it for a long-press copy
    $("#mag" + i).classList.add("open");
    b.textContent = "Long-press below";
  }
});

async function run(){
  const typed = $("#q").value.trim(); if(!typed) return;
  $("#btn").disabled = true; $("#q").blur();
  out.innerHTML = `<div class="status"><span class="spin"></span>Searching nyaa…</div>`;

  // A cold connection to nyaa measured over 12s from a wired line, and this
  // is a phone on 4G. Without a running count a slow search is
  // indistinguishable from a frozen one.
  const t0 = Date.now();
  const tick = setInterval(() => {
    const el = out.querySelector(".status");
    if(!el) return;
    const secs = Math.round((Date.now() - t0) / 1000);
    if(secs < 5) return;
    el.innerHTML = '<span class="spin"></span>Searching nyaa… ' + secs + 's' +
      (secs >= 20 ? '<br><br>Slow route today. Still waiting — it usually lands.' : '');
  }, 1000);

  try{
    // The season is stripped from what nyaa is asked, because nyaa matches
    // substrings: "season 1" matches the word Season in a Season 4 title,
    // and "1" matches 1080p. It is applied here instead.
    rememberSearch(typed);
    const {q, season} = parseQuery(typed);
    const all = await fetchNyaa(q, "1_2", opts.trusted ? "2" : "0");

    let raw = all, seasonNote = "";
    if(season !== null){
      const hit = all.filter(it => it.parsed.season === season);
      if(hit.length){
        raw = hit;
        seasonNote = " · S" + season;
      }else{
        seasonNote = " · no S" + season;
      }
    }
    SEASON_NOTE = seasonNote;

    const top = raw.slice(0, 40);

    // Ask TorBox which of these it already has before scoring: a cached
    // torrent ignores the seeder penalty, so this changes the order, not
    // just the badges. Non-fatal — without TorBox the ranking is unchanged.
    render(top.map(it => (scoreItem(it, opts), it)).sort((a,b) => b.score - a.score), q);
    if(await markCached(top)){
      top.forEach(it => scoreItem(it, opts));
      top.sort((a,b) => b.score - a.score);
      render(top, q);
    }
  }catch(err){
    $("#hcount").textContent = "";
    // The old copy talked about CORS relays and preview frames, neither of
    // which exists in the app — the native build fetches nyaa directly.
    const msg = err.message || String(err);
    const timedOut = /timed out|timeout/i.test(msg);
    out.innerHTML = `<div class="status err"><b>Couldn't reach nyaa.si</b>
      ${NATIVE
        ? (timedOut
            ? `The connection opened but nyaa didn't answer in time. It sits on a
               slow offshore host and a mobile connection makes that worse — trying
               again often works. If it never does, Settings → Run diagnostics will
               say which stage is failing.`
            : `Your ISP blocks nyaa.si at DNS, and the app works around that itself.
               If this keeps happening, Settings → Run diagnostics shows exactly
               which stage failed.`)
        : `In a browser nyaa has to be reached through a public CORS relay, and
           those break constantly. The Android app fetches it directly.`}
      <code>${esc(msg)}</code></div>`;
  }
  clearInterval(tick);
  $("#btn").disabled = false;
}
$("#btn").onclick = run;
$("#q").addEventListener("keydown", e => { if(e.key === "Enter") run(); });

if(NATIVE){
  $("#foot").innerHTML = "Tap <b>Open</b> to hand the magnet straight to your "
    + "torrent app. <b>Copy magnet</b> is there if you would rather paste it "
    + "yourself. Fetching directly — no proxy.";
}

/* ====================================================================
   PREFERENCES — persisted. Nothing used to survive a relaunch.
   ==================================================================== */
const PREF_KEY = "nyaarank.prefs";

function savePrefs(){
  try{
    localStorage.setItem(PREF_KEY, JSON.stringify({
      thrift:opts.thrift, res:opts.res, dual:opts.dual, trusted:opts.trusted
    }));
  }catch(e){ /* private mode / quota — not worth interrupting the user */ }
}

function loadPrefs(){
  let p;
  try{ p = JSON.parse(localStorage.getItem(PREF_KEY) || "null"); }catch(e){ return; }
  if(!p) return;
  if(typeof p.thrift === "number") opts.thrift = p.thrift;
  if(typeof p.res === "string")    opts.res    = p.res;
  opts.dual = !!p.dual; opts.trusted = !!p.trusted;

  // reflect restored values back into the controls
  $("#thrift").value = Math.round(opts.thrift * 100);
  for(const b of $("#segres").children)
    b.setAttribute("aria-pressed", String(b.dataset.v === opts.res));
  for(const b of $("#segopt").children)
    b.setAttribute("aria-pressed", String(!!opts[b.dataset.k]));
  syncLabel();
}

// piggy-back on the existing handlers rather than rewriting them
$("#thrift").addEventListener("input", savePrefs);
$("#segres").addEventListener("click", savePrefs);
$("#segopt").addEventListener("click", savePrefs);
loadPrefs();

/* ====================================================================
   TAB ROUTER
   ==================================================================== */
const SCREENS = {search:"#scr-search", transfers:"#scr-transfers",
                 downloads:"#scr-downloads",
                 account:"#scr-account", settings:"#scr-settings"};
let activeTab = "search";

function showTab(name){
  if(!SCREENS[name]) return;
  activeTab = name;
  for(const [k, sel] of Object.entries(SCREENS)) $(sel).hidden = (k !== name);
  for(const b of $("#tabbar").children)
    b.setAttribute("aria-pressed", String(b.dataset.tab === name));
  if(name === "account") refreshAccount();   // on focus, not on a timer
  if(name === "settings") renderSettings();  // also clears any stuck state
  if(name === "transfers"){ xferDelay = 2000; refreshTransfers(); }
  else stopXferPoll();
  if(name === "downloads") renderDownloads();
  else stopDlPoll();                       // never poll a tab you cannot see
}

$("#tabbar").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]");
  if(b) showTab(b.dataset.tab);
});

/* ====================================================================
   SHEET
   ==================================================================== */
function openSheet(html){
  $("#sheetbody").innerHTML = html;
  $("#scrim").hidden = false;
  $("#sheet").hidden = false;
}
$("#scrim").addEventListener("click", closeSheet);

/* ====================================================================
   TORBOX CLIENT

   All calls go through the native bridge. TorBox's API only sends
   access-control-allow-origin for https://torbox.app, so a browser
   build genuinely cannot reach it — native-only by their design.

   Response envelope is {success, error, detail, data}. The docs say
   `detail` is safe to show users verbatim, so it is used as-is.
   ==================================================================== */
const TB = {
  BASE: "https://api.torbox.app/v1/api",
  token: "",
  me: null,
  locked: {},   // endpoint prefix -> true when the paid gate answered

  loadToken(){
    try{
      this.token = (NATIVE && window.Nyaa.getKey) ? (window.Nyaa.getKey() || "") : "";
    }catch(e){ this.token = ""; }
  },

  saveToken(t){
    this.token = t || "";
    try{ if(NATIVE && window.Nyaa.setKey) window.Nyaa.setKey(this.token); }catch(e){}
  },

  signedIn(){ return !!this.token; },

  /* Resolves {status, env}. Throws only on transport/parse failure. */
  async call(path, o){
    o = o || {};
    if(!NATIVE)
      throw new Error("TorBox needs the Android app — their API refuses browser origins.");
    const spec = {method: o.method || "GET", url: this.BASE + path, headers: {}};
    if(o.auth !== false && this.token)
      spec.headers["Authorization"] = "Bearer " + this.token;
    if(o.body) spec.body = o.body;

    const r = await nativeRequest(spec, o.timeout);
    let env;
    try{ env = JSON.parse(r.body); }
    catch(e){
      throw new Error("TorBox sent a non-JSON reply (HTTP " + r.status + ")");
    }
    // TorBox gates its whole torrent API behind a paid plan. Auth and
    // /user/me work on Free, everything else answers with this. Remember it
    // so the UI stops offering features that cannot work.
    // Free accounts may use some endpoints (checkcached) but not others
    // (mylist). Record the gate per endpoint so one refusal does not switch
    // off features that demonstrably work.
    if(env && env.error === "PLAN_RESTRICTED_FEATURE") TB.locked[path.split("?")[0]] = true;
    return {status: r.status, env: env};
  }
};

/* Field names inside `data` are not in TorBox's OpenAPI spec — every
   responses.200 is empty. Rather than guess one name and silently show
   nothing, try the plausible ones and let the raw JSON panel settle it. */
function pickField(obj, names, dflt){
  if(!obj) return dflt;
  for(const n of names){
    if(obj[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return dflt;
}

function fmtBytes(n){
  n = +n;
  if(!isFinite(n) || n <= 0) return "—";
  const u = ["B","KiB","MiB","GiB","TiB"];
  let i = 0;
  while(n >= 1024 && i < u.length - 1){ n /= 1024; i++; }
  return (n >= 100 ? Math.round(n) : n.toFixed(n >= 10 ? 1 : 2)) + " " + u[i];
}

/* ====================================================================
   SIGN IN — device code flow

     GET  /user/auth/device/start?app=nyaarank
       -> data {code, device_code, interval, expires_at,
                verification_url, friendly_verification_url}
     POST /user/auth/device/token  {device_code}
       -> HTTP 400 + error DEVICE_CODE_NOT_USED while still pending
       -> success once approved

   Both shapes above are observed against the live API, not documented.
   ==================================================================== */
let authTimer = null, authStop = false;

async function startSignIn(){
  authStop = false;
  $("#acct").innerHTML = '<div class="status"><span class="spin"></span> Starting sign-in…</div>';
  let d;
  try{
    const r = await TB.call("/user/auth/device/start?app=nyaarank", {auth:false});
    if(!r.env.success) throw new Error(r.env.detail || r.env.error || "could not start sign-in");
    d = r.env.data;
  }catch(e){
    renderSignedOut(e.message || String(e));
    return;
  }

  const code       = pickField(d, ["code","user_code"], "??????");
  const url        = pickField(d, ["verification_url","verification_uri"], "https://torbox.app/oauth/device");
  const shortUrl   = pickField(d, ["friendly_verification_url"], url);
  const interval   = (+pickField(d, ["interval"], 5)) * 1000;
  const deviceCode = pickField(d, ["device_code"], "");
  const expiresAt  = Date.parse(pickField(d, ["expires_at"], "")) || (Date.now() + 600000);

  $("#acct").innerHTML =
    '<div class="signin">' +
      '<h3 class="lbl">Your code</h3>' +
      '<div class="code">' + esc(String(code)) + '</div>' +
      '<p>Open TorBox and enter this code to link the app.<br>' +
        '<span class="mono" style="font-size:11.5px">' + esc(shortUrl) + '</span></p>' +
      '<button class="btn-big" id="openTb">Open TorBox</button>' +
      '<button class="btn-ghost" id="cancelAuth">Cancel</button>' +
      '<p class="hint" id="authState"><span class="spin"></span> Waiting for you to approve…</p>' +
    '</div>';

  $("#openTb").onclick = () => {
    try{ if(NATIVE && window.Nyaa.openUrl) window.Nyaa.openUrl(url); }catch(e){}
  };
  $("#cancelAuth").onclick = () => {
    authStop = true; clearTimeout(authTimer); renderSignedOut();
  };

  const poll = async () => {
    if(authStop) return;
    if(Date.now() > expiresAt){ renderSignedOut("That code expired. Try again."); return; }
    try{
      const r = await TB.call("/user/auth/device/token", {
        method: "POST", auth: false,
        body: {kind:"json", data:{device_code: deviceCode}}
      });
      const env = r.env;

      if(env.success){
        const tok = (typeof env.data === "string") ? env.data
          : pickField(env.data, ["token","api_key","auth_token","access_token","key"], "");
        if(!tok){
          renderSignedOut("Approved, but the token arrived under an unexpected field. Raw: "
                          + JSON.stringify(env.data).slice(0, 300));
          return;
        }
        TB.saveToken(tok);
        refreshAccount();
        return;
      }
      if(env.error && env.error !== "DEVICE_CODE_NOT_USED"){
        renderSignedOut(env.detail || env.error);
        return;
      }
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      const el = $("#authState");
      if(el){
        el.innerHTML = '<span class="spin"></span> Waiting for you to approve… '
          + Math.floor(left/60) + ":" + String(left%60).padStart(2,"0");
      }
      authTimer = setTimeout(poll, interval);
    }catch(e){
      renderSignedOut(e.message || String(e));
    }
  };
  authTimer = setTimeout(poll, interval);
}

function renderSignedOut(err){
  clearTimeout(authTimer); authStop = true;
  $("#acct").innerHTML =
    '<div class="signin">' +
      '<p>Sign in to TorBox to see which releases download <b>instantly</b>, ' +
        'and to grab the ones with dead swarms.</p>' +
      (err ? '<div class="err-txt">' + esc(String(err)) + '</div>' : '') +
      '<button class="btn-big" id="doSignin">Sign in to TorBox</button>' +
      (NATIVE ? '' : '<p class="hint">TorBox only accepts requests from their own ' +
        'site in a browser, so this works in the Android app only.</p>') +
      '<details class="adv">' +
        '<summary>Advanced — paste a key</summary>' +
        '<input type="password" id="manualKey" placeholder="TorBox API key" autocomplete="off">' +
        '<button class="btn-ghost" id="saveKey">Save key</button>' +
        '<p class="hint">Only needed if sign-in fails. The key is stored by the app, ' +
          'not in the web page.</p>' +
      '</details>' +
    '</div>';

  $("#doSignin").onclick = startSignIn;
  const sk = $("#saveKey");
  if(sk) sk.onclick = () => {
    const v = ($("#manualKey").value || "").trim();
    if(v){ TB.saveToken(v); refreshAccount(); }
  };
}

/* ====================================================================
   ACCOUNT SCREEN
   ==================================================================== */
async function refreshAccount(){
  TB.loadToken();
  if(!TB.signedIn()){ renderSignedOut(); return; }

  $("#acct").innerHTML = '<div class="status"><span class="spin"></span> Loading account…</div>';
  let env, status;
  try{
    const r = await TB.call("/user/me");
    env = r.env; status = r.status;
  }catch(e){
    $("#acct").innerHTML = '<div class="status err"><b>Couldn\'t reach TorBox</b>' +
      '<code>' + esc(e.message || String(e)) + '</code></div>';
    return;
  }

  if(status === 403 || env.error === "BAD_TOKEN" || env.error === "AUTH_ERROR"){
    TB.saveToken("");
    renderSignedOut("That sign-in is no longer valid. Sign in again.");
    return;
  }
  if(!env.success){
    $("#acct").innerHTML = '<div class="status err"><b>TorBox said no</b>' +
      '<code>' + esc(env.detail || env.error || "unknown error") + '</code></div>';
    return;
  }

  TB.me = env.data || {};
  renderAccount(TB.me);
}

/* plan 0 = Free is confirmed from a live response. The rest are inferred
   from TorBox's published plan tiers and not yet seen in the wild — an
   unknown number falls back to "plan N" rather than guessing a name. */
const PLAN_NAMES = {0:"free", 1:"essential", 2:"standard", 3:"pro"};

/* Per-download caps are not returned by the API, so they live here.
   Note the two published sources disagree for Pro: the API error table says
   536870912000 (500 GiB) while the pricing page says 1 TB. Taking the larger
   deliberately — being too permissive surfaces TorBox's own error message,
   which is informative, whereas being too strict blocks a download that
   would have worked and gives the user no way to try. */
const PLAN_CAPS = {
  0: 10737418240,      // free      10 GiB
  1: 214748364800,     // essential 200 GiB
  2: 214748364800,     // standard  200 GiB
  3: 1099511627776     // pro       1 TiB
};

/* Permanent storage included with each plan — the reason a separate cloud
   service is mostly redundant once subscribed. */
const PLAN_STORAGE = {
  0: 0,
  1: 322122547200,     // essential 300 GB
  2: 536870912000,     // standard  500 GB
  3: 1099511627776     // pro       1 TB
};

function renderAccount(d){
  // Field names below are the real ones, read off a live /user/me response.
  // Note there is NO bandwidth-limit field: TorBox reports lifetime totals
  // only, so there is no denominator to draw a usage bar against. The number
  // that actually constrains you is the per-download cap, which comes from
  // the plan and is documented rather than returned by the API.
  const who      = pickField(d, ["email","base_email"], "Signed in");
  const planNum  = +pickField(d, ["plan"], 0);
  const planLabel = PLAN_NAMES[planNum] || ("plan " + planNum);
  const cap      = PLAN_CAPS[planNum] || 0;
  const dlBytes  = +pickField(d, ["total_bytes_downloaded"], 0);
  const dlCount  = +pickField(d, ["torrents_downloaded"], 0);
  const since    = pickField(d, ["created_at"], null);
  const expires  = pickField(d, ["premium_expires_at"], null);
  const cooldown = pickField(d, ["cooldown_until"], null);

  // The per-download cap is the single most consequential number on Free:
  // it decides which search results can go through TorBox at all.
  const store = PLAN_STORAGE[planNum] || 0;
  const usageHtml = cap
    ? '<div class="acard">' +
        '<h3>Per-download limit</h3>' +
        '<div class="who" style="margin-bottom:2px">' + esc(fmtBytes(cap)) + '</div>' +
        '<p class="hint" style="margin:0 0 10px">Any single torrent larger than ' +
          'this cannot be added to TorBox on your plan.</p>' +
        (store
          ? '<h3 style="margin-top:12px">Permanent storage</h3>' +
            '<div class="who" style="margin-bottom:2px">' + esc(fmtBytes(store)) + '</div>' +
            '<p class="hint" style="margin:0">Files stay on TorBox, so they need ' +
              'no space on this phone.</p>'
          : '') +
      '</div>'
    : '';

  // A date in the past means the opposite of what the label would imply:
  // an expiry that has passed is "premium ended", and a cooldown that has
  // passed is no cooldown at all. Label by which side of now it falls on,
  // and drop a stale cooldown entirely rather than implying one is active.
  const now = Date.now();
  const expTs  = expires  ? Date.parse(expires)  : NaN;
  const coolTs = cooldown ? Date.parse(cooldown) : NaN;
  const day = t => new Date(t).toISOString().slice(0, 10);
  const minute = t => new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const sinceTs = since ? Date.parse(since) : NaN;

  const rows =
    (dlBytes > 0
      ? '<div class="stat"><span class="k">Downloaded all time</span>' +
        '<span class="v">' + esc(fmtBytes(dlBytes)) + '</span></div>' : '') +
    (dlCount > 0
      ? '<div class="stat"><span class="k">Torrents</span>' +
        '<span class="v">' + esc(String(dlCount)) + '</span></div>' : '') +
    (isFinite(sinceTs)
      ? '<div class="stat"><span class="k">Member since</span>' +
        '<span class="v">' + esc(day(sinceTs)) + '</span></div>' : '') +
    (isFinite(expTs)
      ? '<div class="stat"><span class="k">' + (expTs > now ? "Renews" : "Premium ended") + '</span>' +
        '<span class="v">' + esc(day(expTs)) + '</span></div>' : '') +
    (isFinite(coolTs) && coolTs > now
      ? '<div class="stat"><span class="k">Cooldown until</span>' +
        '<span class="v">' + esc(minute(coolTs)) + '</span></div>' : '');

  $("#acct").innerHTML =
    '<div class="acard">' +
      '<div class="who">' + esc(String(who)) + '</div>' +
      '<span class="plan ' + esc(planLabel) + '">' + esc(planLabel) + '</span>' +
    '</div>' +
    usageHtml +
    (rows ? '<div class="acard"><h3>Account</h3>' + rows + '</div>' : '') +
    '<details class="adv">' +
      '<summary>Raw /user/me response</summary>' +
      '<p class="hint">Shown because TorBox does not publish these field names. ' +
        'If anything above reads "unknown" or is missing, the real name is in here.</p>' +
      '<pre class="raw">' + esc(JSON.stringify(d, null, 1)) + '</pre>' +
    '</details>' +
    '<button class="btn-ghost" id="signOut">Sign out</button>';

  $("#signOut").onclick = () => { TB.saveToken(""); TB.me = null; renderSignedOut(); };
}

/* boot */
TB.loadToken();
renderSignedOut();

/* ====================================================================
   SETTINGS + SELF UPDATE

   Releases are published to GitHub as tag "v<versionCode>" with the APK
   attached, so the comparison is a plain integer and never depends on
   parsing a version string.

   Public repo on purpose: private release assets need an Authorization
   header, and the only way to give the app one is to ship the token
   inside the APK, where anyone can unzip it out.
   ==================================================================== */
const GH_REPO = "Javieboy/nyaarank";

function appVersion(){
  try{
    if(NATIVE && window.Nyaa.appVersion) return JSON.parse(window.Nyaa.appVersion());
  }catch(e){}
  return {code: 0, name: "browser"};
}

async function fetchLatestRelease(){
  const r = await nativeRequest({
    method: "GET",
    url: "https://api.github.com/repos/" + GH_REPO + "/releases/latest",
    headers: {"Accept": "application/vnd.github+json", "User-Agent": "nyaarank"}
  });
  if(r.status === 404) throw new Error("No releases published yet.");
  if(r.status !== 200) throw new Error("GitHub returned HTTP " + r.status);

  const j = JSON.parse(r.body);
  const tag = String(j.tag_name || "");
  const code = parseInt(tag.replace(/^v/i, ""), 10);
  const apk = (j.assets || []).filter(a => /\.apk$/i.test(a.name || ""))[0];
  return {
    code: isFinite(code) ? code : 0,
    tag: tag,
    url: apk ? apk.browser_download_url : "",
    size: apk ? apk.size : 0,
    notes: String(j.body || "").trim()
  };
}

function renderSettings(){
  const v = appVersion();
  $("#prefs").innerHTML =
    renderAppearance() +
    '<div class="acard">' +
      '<h3>Version</h3>' +
      '<div class="stat"><span class="k">Installed</span>' +
        '<span class="v">' + esc(v.name) + '  (build ' + esc(String(v.code)) + ')</span></div>' +
      '<div id="upslot"></div>' +
    '</div>' +
    (NATIVE ? '' :
      '<p class="hint">Updates only apply to the Android build.</p>');

  const slot = $("#upslot");
  if(!NATIVE){ slot.innerHTML = ''; return; }
  slot.innerHTML = '<button class="btn-ghost" id="chkUp">Check for updates</button>';
  $("#chkUp").onclick = doUpdateCheck;

  $("#prefs").insertAdjacentHTML("beforeend",
    '<div class="acard">' +
      '<h3>Network</h3>' +
      '<p class="hint" style="margin-top:0">Your ISP blocks nyaa.si and TorBox at ' +
        'DNS. The app resolves them itself over DoH. If search fails, run this ' +
        'and send the result.</p>' +
      '<button class="btn-ghost" id="diagBtn">Run diagnostics</button>' +
      '<div id="diagOut"></div>' +
    '</div>' +
    '<div class="acard">' +
      '<h3>TorBox API probe</h3>' +
      '<p class="hint" style="margin-top:0">Dumps the real response shapes for ' +
        'mylist and createstream, which are not published. Never prints your token.</p>' +
      '<button class="btn-ghost" id="tbProbeBtn">Probe TorBox API</button>' +
      '<div id="tbProbeOut"></div>' +
    '</div>');
  $("#diagBtn").onclick = runDiagnostics;
  $("#tbProbeBtn").onclick = probeTorBox;
  wireAppearance();
}

async function runDiagnostics(){
  const out = $("#diagOut");
  out.innerHTML = '<p class="hint"><span class="spin"></span> Probing…</p>';
  try{
    const r = await new Promise((resolve, reject) => {
      const token = "t" + (++TOKEN);
      const timer = setTimeout(() => {
        delete PENDING[token];
        reject(new Error("diagnostics timed out"));
      }, 90000);
      PENDING[token] = {resolve, reject, timer};
      window.Nyaa.diagnose(token);
    });
    out.innerHTML = '<pre class="raw">' + esc(r.body) + '</pre>';
  }catch(e){
    out.innerHTML = '<p class="err-txt">' + esc(e.message || String(e)) + '</p>';
  }
}

async function doUpdateCheck(){
  const slot = $("#upslot");
  slot.innerHTML = '<p class="hint"><span class="spin"></span> Checking…</p>';
  const v = appVersion();
  let rel;
  try{
    rel = await fetchLatestRelease();
  }catch(e){
    slot.innerHTML = '<p class="err-txt">' + esc(e.message || String(e)) + '</p>' +
      '<button class="btn-ghost" id="chkUp">Try again</button>';
    $("#chkUp").onclick = doUpdateCheck;
    return;
  }

  if(!rel.url){
    slot.innerHTML = '<p class="hint">Latest release ' + esc(rel.tag) +
      ' has no APK attached.</p>' +
      '<button class="btn-ghost" id="chkUp">Check again</button>';
    $("#chkUp").onclick = doUpdateCheck;
    return;
  }

  if(rel.code <= v.code){
    slot.innerHTML = '<p class="hint">You are on the latest build.</p>' +
      '<button class="btn-ghost" id="chkUp">Check again</button>';
    $("#chkUp").onclick = doUpdateCheck;
    return;
  }

  slot.innerHTML =
    '<p class="hint" style="color:var(--teal)">Build ' + esc(String(rel.code)) +
      ' is available' + (rel.size ? ' (' + esc(fmtBytes(rel.size)) + ')' : '') + '.</p>' +
    (rel.notes ? '<pre class="raw">' + esc(rel.notes.slice(0, 700)) + '</pre>' : '') +
    '<button class="btn-big" id="doUp">Download and install</button>' +
    '<p class="hint" id="upHint">Android will ask permission to install from ' +
      'nyaarank the first time.</p>';

  $("#doUp").onclick = () => {
    try{
      window.Nyaa.installUpdate(rel.url);
      // Never disable this button. Android's install dialog is dismissed by
      // tapping anywhere outside it, which is easy to do by accident, and a
      // disabled button then leaves no way to retry without restarting the
      // app. The APK is ~44 KB, so re-tapping costs effectively nothing.
      $("#doUp").textContent = "Install build " + rel.code;
      $("#upHint").textContent =
        "Tap Install when Android asks. If that prompt disappears — tapping " +
        "outside it closes it — just press this button again.";
    }catch(e){
      slot.innerHTML = '<p class="err-txt">' + esc(String(e)) + '</p>';
    }
  };
}


/* ====================================================================
   TORBOX — cached lookup, send, transfers

   Rate limits shape this: createtorrent is 60/hour for uncached items
   but 300/min for cached ones, so we always check cached first and
   never add blind.
   ==================================================================== */

const CACHE_SEEN = {};        // infoHash -> true/false, per session

/** Per-download cap for the signed-in plan, or 0 if unknown. */
function planCap(){
  if(!TB.me) return 0;
  return PLAN_CAPS[+pickField(TB.me, ["plan"], -1)] || 0;
}

/**
 * Batch-checks every result hash in one call and marks it.cached.
 * Failures are non-fatal: without TorBox the app still ranks normally.
 */
async function markCached(items){
  if(!NATIVE || !TB.signedIn() || TB.locked["/torrents/checkcached"]) return false;

  const wasLocked = !!TB.locked["/torrents/checkcached"];
  const need = [];
  for(const it of items){
    const h = it.hash;
    if(!h) continue;
    if(CACHE_SEEN[h] === undefined) need.push(h);
    else it.cached = CACHE_SEEN[h];
  }
  if(!need.length) return items.some(x => x.cached);

  try{
    // GET with comma-separated hashes; TorBox documents ~100 per call.
    const chunk = need.slice(0, 100).join(",");
    const r = await TB.call("/torrents/checkcached?format=object&hash="
                            + encodeURIComponent(chunk));
    if(!r.env || !r.env.success) return false;

    // Shape is not documented. Observed possibilities: an object keyed by
    // hash, or a list of objects carrying a hash field. Handle both, and
    // treat anything absent as not cached.
    const data = r.env.data;
    const hits = {};
    if(data && typeof data === "object" && !Array.isArray(data)){
      for(const k of Object.keys(data)) if(data[k]) hits[k.toLowerCase()] = true;
    }else if(Array.isArray(data)){
      for(const e of data){
        const h = e && (e.hash || e.infoHash);
        if(h) hits[String(h).toLowerCase()] = true;
      }
    }

    for(const h of need) CACHE_SEEN[h] = !!hits[String(h).toLowerCase()];
    for(const it of items) if(it.hash) it.cached = !!CACHE_SEEN[it.hash];
    return Object.keys(hits).length > 0 || (!!TB.locked["/torrents/checkcached"] && !wasLocked);
  }catch(e){
    return !!TB.locked["/torrents/checkcached"] && !wasLocked;
  }
}

/** The Send-to-TorBox row under a result, or "" when it does not apply. */
function tbAction(it, i){
  if(!NATIVE || !TB.signedIn() || TB.locked["/torrents/createtorrent"]) return "";

  const cap = planCap();
  const over = cap && it.sizeMB * 1048576 > cap;

  if(over){
    return '<div class="tbrow over">' +
      '<span class="tbnote">' + esc(fmtMB(it.sizeMB)) + ' — over your ' +
      esc(fmtBytes(cap)) + ' per-download limit</span></div>';
  }
  return '<div class="tbrow">' +
    '<button class="btn tb" data-tb="' + i + '">' +
      (it.cached ? "Send to TorBox — instant" : "Send to TorBox") +
    '</button></div>';
}

/** POST createtorrent with the magnet as a multipart field. */
async function sendToTorBox(it, btn){
  btn.disabled = true;
  btn.textContent = "Sending…";
  try{
    const r = await TB.call("/torrents/createtorrent", {
      method: "POST",
      body: {kind:"multipart", data:{
        magnet: it.magnet,
        allow_zip: "true",
        as_queued: "false"
      }}
    });
    const env = r.env || {};
    if(!env.success){
      btn.disabled = false;
      btn.textContent = "Send to TorBox";
      // TorBox's `detail` is documented as safe to show verbatim.
      alertLine(env.detail || env.error || ("HTTP " + r.status));
      return;
    }
    btn.textContent = "Queued ✓";
    xfersDirty = true;
    $("#xdot").hidden = false;
  }catch(e){
    btn.disabled = false;
    btn.textContent = "Send to TorBox";
    alertLine(e.message || String(e));
  }
}

/* The Send button had no listener at all until now — it rendered and did
   nothing when tapped. */
$("#out").addEventListener("click", e => {
  const b = e.target.closest("[data-tb]");
  if(!b || b.disabled) return;
  const it = RESULTS[+b.dataset.tb];
  if(it) sendToTorBox(it, b);
});

function alertLine(msg){
  const bar = document.createElement("div");
  bar.className = "toast";
  bar.textContent = msg;
  document.body.appendChild(bar);
  setTimeout(() => bar.remove(), 4200);
}

/* ====================================================================
   TRANSFERS
   ==================================================================== */
let xfersDirty = true;
let xferTimer = null;

const STATE_LABEL = {
  cached:"cached", completed:"done", uploading:"seeding", expired:"expired",
  downloading:"downloading", metaDL:"fetching metadata",
  "stalled (no seeds)":"stalled — no seeds", stalled:"stalled",
  paused:"paused", checkingResumeData:"checking"
};

/* TorBox allows auth and /user/me on Free but gates the entire torrent API
   behind a subscription. Say so once, plainly, instead of surfacing the same
   error on every screen that touches it. */
function renderApiLocked(el){
  el.innerHTML =
    '<div class="acard">' +
      '<h3>Needs a paid TorBox plan</h3>' +
      '<p class="hint" style="margin:6px 0 0">TorBox lets free accounts sign in, ' +
        'but its torrent API — checking what is cached, adding torrents, and ' +
        'downloading them — is available on paid plans only.</p>' +
      '<p class="hint">Everything else in nyaarank works without it: search, ' +
        'ranking, the size meter, magnets. You just do the downloading yourself ' +
        'with a torrent app instead of through TorBox.</p>' +
    '</div>';
}

async function refreshTransfers(){
  if(TB.locked["/torrents/mylist"]){ renderApiLocked($("#xfers")); return; }
  if(!NATIVE || !TB.signedIn()){
    $("#xfers").innerHTML =
      '<div class="status">Sign in to TorBox on the Account tab to send ' +
      'torrents here.</div>';
    return;
  }
  if(!$("#xfers").querySelector(".xcard"))
    $("#xfers").innerHTML = '<div class="status"><span class="spin"></span> Loading…</div>';

  let list, httpStatus = 0;
  try{
    const r = await TB.call("/torrents/mylist?bypass_cache=true&limit=50");
    httpStatus = r.status;
    if(!r.env.success) throw new Error(r.env.detail || r.env.error || "failed");
    list = Array.isArray(r.env.data) ? r.env.data : (r.env.data ? [r.env.data] : []);
  }catch(e){
    if(TB.locked["/torrents/mylist"]){ renderApiLocked($("#xfers")); return; }

    const msg = e.message || String(e);
    // A Cloudflare 5xx is TorBox's backend failing behind their CDN. Their
    // wording ("the origin is overloaded or misconfigured") is addressed to
    // an administrator, not to you, and there is nothing to do but wait.
    const theirFault = httpStatus >= 500 ||
      /origin web server|cloudflare|overloaded|misconfigured|bad gateway|gateway time/i.test(msg);

    $("#xfers").innerHTML = theirFault
      ? '<div class="status err"><b>TorBox is having trouble</b>' +
        'Their servers returned an error — nothing wrong on your side, and ' +
        'nothing you saved is affected. It usually clears in a minute.' +
        '<code>' + esc(msg.slice(0, 200)) + '</code>' +
        '<button class="btn-ghost" id="xretry" style="margin-top:14px">Try again</button></div>'
      : '<div class="status err"><b>Couldn\'t load transfers</b>' +
        '<code>' + esc(msg) + '</code>' +
        '<button class="btn-ghost" id="xretry" style="margin-top:14px">Try again</button></div>';

    const rb = $("#xretry");
    if(rb) rb.onclick = () => { xferDelay = 2000; refreshTransfers(); };
    return;
  }

  if(!list.length){
    $("#xfers").innerHTML = '<div class="status">Nothing queued yet.<br><br>' +
      'Search, then tap <b>Send to TorBox</b> on a result.</div>';
    $("#xdot").hidden = true;
    stopXferPoll();
    return;
  }

  // Field names below are the real ones, read off a live mylist response.
  // progress is a 0-1 float, size is bytes, and download_present is what
  // actually says whether the files are still on TorBox — a torrent can sit
  // at progress 1 and still be gone, because TorBox expires them.
  let anyActive = false;
  const xhtml = list.map(t => {
    const id      = pickField(t, ["id"], "");
    const name    = pickField(t, ["name"], "(unnamed)");
    const state   = String(pickField(t, ["download_state"], "")).toLowerCase();
    const pct     = Math.round(Math.max(0, Math.min(1, +pickField(t, ["progress"], 0))) * 100);
    const size    = +pickField(t, ["size"], 0);
    const present = pickField(t, ["download_present"], false) === true;
    const expired = state === "expired" || (pct >= 100 && !present && !!pickField(t, ["expires_at"], null) && !state.startsWith("down"));
    const done    = present && !expired;
    const speed   = +pickField(t, ["download_speed"], 0);
    const eta     = +pickField(t, ["eta"], 0);
    const seeds   = pickField(t, ["seeds"], null);
    if(!done && !expired) anyActive = true;

    // Only offer files that are actually there, and put video first — the
    // probe asking to stream a readme is what produced a 500 earlier.
    // Video first, then natural order by name. Sorting by size put a cour in
    // the order 08, 05, 11, 02 — technically "biggest first", practically
    // nonsense for episodes.
    const files = (Array.isArray(t.files) ? t.files : []).slice().sort((a, b) => {
      const av = /^video\//.test(String(a.mimetype || "")) ? 0 : 1;
      const bv = /^video\//.test(String(b.mimetype || "")) ? 0 : 1;
      if(av !== bv) return av - bv;
      const an = String(pickField(a, ["short_name","name"], ""));
      const bn = String(pickField(b, ["short_name","name"], ""));
      return an.localeCompare(bn, undefined, {numeric: true, sensitivity: "base"});
    });

    const fileBtns = done && files.length ? filesBlock(id, name, files) : '';

    const sub = expired ? "expired — TorBox no longer holds these files"
              : done    ? ""
              : (speed ? fmtBytes(speed) + "/s" : "") +
                (eta && eta > 0 && eta < 86400 ? "  ·  " + Math.round(eta / 60) + " min left" : "") +
                (seeds !== null ? "  ·  " + seeds + " seeds" : "");

    return '<div class="xcard' + (expired ? " gone" : "") + '" data-show="' + esc(name) + '">' +
      '<div class="xtop">' +
        '<div class="poster"></div>' +
        '<div class="xhead">' +
          '<div class="showmeta"></div>' +
          '<div class="xname">' + esc(name) + '</div>' +
      '<div class="xmeta">' +
        '<span class="' + (expired ? "v-bad" : done ? "v-good" : "") + '">' +
          esc(STATE_LABEL[state] || state || "queued") + '</span>' +
        (size ? '<span>' + esc(fmtBytes(size)) + '</span>' : '') +
      '</div>' +
        '</div>' +
      '</div>' +
      (done || expired ? '' :
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="xmeta"><span>' + pct + '%</span></div>') +
      (sub ? '<div class="xmeta"><span>' + esc(sub) + '</span></div>' : '') +
      fileBtns +
      '<div class="xacts">' +
        (done && files.length > 1
          ? '<button class="btn xall">Save all</button>' : '') +
        '<button class="btn xdel" data-del="' + esc(String(id)) + '">Remove</button>' +
      '</div>' +
    '</div>';
  }).join("");

  patchList($("#xfers"), "#scr-transfers", xhtml);
  $("#xdot").hidden = !anyActive;
  decoratePosters($("#xfers"));
  if(anyActive) startXferPoll(); else stopXferPoll();
}

/* Back off rather than hammering, and never poll a hidden tab — a fixed
   interval in the background is a battery bug. */
let xferDelay = 2000;
function startXferPoll(){
  stopXferPoll();
  xferTimer = setTimeout(async () => {
    if(activeTab !== "transfers" || document.hidden){ stopXferPoll(); return; }
    await refreshTransfers();
    xferDelay = Math.min(15000, Math.round(xferDelay * 1.6));
  }, xferDelay);
}
function stopXferPoll(){
  if(xferTimer){ clearTimeout(xferTimer); xferTimer = null; }
}

/**
 * Both lists stop polling when the app goes away, which was the whole story
 * — nothing ever started them again, so coming back showed a frozen list
 * with a stale percentage and a nonsense estimate.
 *
 * Java also calls __nyaaResume from onResume, because a WebView does not
 * reliably fire visibilitychange when the app is backgrounded.
 */
function onAppResume(){
  // measured speed is meaningless across a gap of unknown length
  for(const k in SPEED) delete SPEED[k];

  if(activeTab === "downloads") renderDownloads();
  else if(activeTab === "transfers"){ xferDelay = 2000; refreshTransfers(); }
  else if(activeTab === "account") refreshAccount();
}
window.__nyaaResume = onAppResume;

document.addEventListener("visibilitychange", () => {
  if(document.hidden){ stopXferPoll(); stopDlPoll(); return; }
  onAppResume();
});

/* ---- transfer actions ---- */
/** Direct CDN link for one file. Carries the token — never log or display it. */
function dlUrl(tid, fid){
  return TB.BASE + "/torrents/requestdl?token=" + encodeURIComponent(TB.token) +
         "&torrent_id=" + encodeURIComponent(tid) +
         "&file_id=" + encodeURIComponent(fid) + "&redirect=true";
}

$("#xfers").addEventListener("click", async e => {
  const all = e.target.closest(".xall");
  if(all){ saveAll(all); return; }

  const pl = e.target.closest(".xplay");
  if(pl){
    try{
      window.Nyaa.play(dlUrl(pl.dataset.tid, pl.dataset.fid), pl.dataset.name || "");
    }catch(err){ alertLine(String(err)); }
    return;
  }

  const dl = e.target.closest("[data-fid]");
  if(dl){
    if(alreadyQueued(dl.dataset.name, dl.dataset.folder)){
      const had = dl.textContent;
      dl.textContent = "✓";
      alertLine("Already saved — it is on the Files tab");
      setTimeout(() => { dl.textContent = had; }, 2000);
      return;
    }
    dl.disabled = true;
    const was = dl.textContent;
    dl.textContent = "Getting link…";
    try{
      saveFile(dl.dataset.tid, dl.dataset.fid, dl.dataset.name, dl.dataset.folder);
      dl.textContent = "Downloading…";
      setTimeout(() => { dl.disabled = false; dl.textContent = was; }, 6000);
    }catch(err){
      dl.disabled = false; dl.textContent = was;
      alertLine(String(err));
    }
    return;
  }

  const del = e.target.closest("[data-del]");
  if(del){
    // Two taps, not a dialog: window.confirm() is silently suppressed in a
    // WebView with no WebChromeClient, so it would return false and the
    // button would simply never work.
    //
    // This deletes from TorBox itself, not just from this list — on a paid
    // plan that is removing files from your storage.
    const card = del.closest(".xcard");
    const label = card ? (card.querySelector(".xname") || {}).textContent || "" : "";
    const go = await confirmDialog({
      title: "Delete from TorBox?",
      body: "This removes it from your TorBox storage, not just from this " +
            "list. Anything already saved to your phone is unaffected." +
            (label ? "<br><br><b>" + esc(label) + "</b>" : ""),
      yes: "Delete from TorBox"
    });
    if(!go) return;

    del.disabled = true;
    del.textContent = "Deleting…";
    try{
      const r = await TB.call("/torrents/controltorrent", {
        method: "POST",
        body: {kind:"json", data:{torrent_id: +del.dataset.del, operation: "delete"}}
      });
      if(r.env && r.env.success === false)
        throw new Error(r.env.detail || r.env.error || "delete refused");
      xferDelay = 2000;
      refreshTransfers();
    }catch(err){
      del.disabled = false;
      del.textContent = "Remove";
      alertLine(err.message || String(err));
    }
  }
});

/* ====================================================================
   TORBOX API PROBE

   Four endpoints were written against guessed response shapes because
   TorBox's OpenAPI spec leaves every responses.200 empty and CORS stops
   a browser from calling them. This dumps the real ones.

   Never prints the token. requestdl carries it in the query string, so
   that endpoint is deliberately not called here.
   ==================================================================== */
async function probeTorBox(){
  const out = $("#tbProbeOut");
  if(!NATIVE || !TB.signedIn()){
    out.innerHTML = '<p class="hint">Sign in to TorBox first.</p>';
    return;
  }
  out.innerHTML = '<p class="hint"><span class="spin"></span> Probing…</p>';

  const lines = [];
  const trim = (o, n) => {
    const s = JSON.stringify(o, null, 1);
    return s.length > n ? s.slice(0, n) + "\n… (" + s.length + " chars total)" : s;
  };

  async function step(label, path, opts, cap){
    try{
      const r = await TB.call(path, opts);
      lines.push("### " + label + "   HTTP " + r.status);
      if(r.env && r.env.error) lines.push("error: " + r.env.error + " — " + (r.env.detail || ""));
      lines.push(trim(r.env && r.env.data !== undefined ? r.env.data : r.env, cap || 900));
      return r.env;
    }catch(e){
      lines.push("### " + label + "\nFAILED " + (e.message || String(e)));
      return null;
    }
  }

  const me = await step("GET /user/me", "/user/me", null, 700);

  const list = await step("GET /torrents/mylist", "/torrents/mylist?bypass_cache=true&limit=50", null, 1600);

  // Pick a torrent to ask about, so createstream has something real to work on.
  let tid = null, fid = null;
  const arr = list && Array.isArray(list.data) ? list.data
            : (list && Array.isArray(list) ? list : null);
  const first = arr && arr.length ? arr[0] : null;
  if(first){
    tid = first.id;
    // must be a video that is still present, or createstream answers PGRST116
    const vids = (first.files || []).filter(f => String(f.mimetype || "").indexOf("video/") === 0);
    if(vids.length) fid = vids[0].id;
    else if((first.files || []).length) fid = first.files[0].id;
  }

  if(tid !== null && tid !== undefined){
    await step("GET /stream/createstream?id=" + tid,
               "/stream/createstream?id=" + encodeURIComponent(tid) +
               (fid !== null && fid !== undefined ? "&file_id=" + encodeURIComponent(fid) : ""),
               null, 1400);
  }else{
    lines.push("### /stream/createstream\nskipped — no torrent in the list yet. " +
               "Send one to TorBox from Search, wait for it, then run this again.");
  }

  out.innerHTML = '<pre class="raw">' + esc(lines.join("\n\n")) + '</pre>';
}

/* ====================================================================
   FILE LIST

   Every filename in a torrent repeats the same long prefix — the release
   name, the group, the resolution — so a flat list is fifteen rows of
   identical text with the one distinguishing part cut off the end. Strip
   the shared prefix and suffix and what is left is the episode number,
   which is the only thing you were reading anyway.
   ==================================================================== */

/** Longest leading run shared by every string, trimmed to a word boundary. */
function sharedPrefix(names){
  if(names.length < 2) return "";
  let p = names[0];
  for(const n of names){
    let i = 0;
    while(i < p.length && i < n.length && p[i] === n[i]) i++;
    p = p.slice(0, i);
    if(!p) return "";
  }
  // do not cut mid-word: back up to the last separator
  const cut = Math.max(p.lastIndexOf(" "), p.lastIndexOf("-"),
                       p.lastIndexOf("_"), p.lastIndexOf("."));
  return cut > 0 ? p.slice(0, cut + 1) : "";
}

/** Same idea from the right, so a trailing "[1080p BD FLAC].mkv" goes too. */
function sharedSuffix(names){
  if(names.length < 2) return "";
  let s = names[0];
  for(const n of names){
    let i = 0;
    while(i < s.length && i < n.length && s[s.length-1-i] === n[n.length-1-i]) i++;
    s = s.slice(s.length - i);
    if(!s) return "";
  }
  const cut = Math.min(...[" ", "-", "_", "[", "("].map(c => {
    const k = s.indexOf(c);
    return k < 0 ? Infinity : k;
  }));
  return isFinite(cut) ? s.slice(cut) : "";
}

function filesBlock(tid, torrentName, files){
  const raw = files.map(f => String(pickField(f, ["short_name","name"], "file")).split("/").pop());
  const pre = sharedPrefix(raw);
  const suf = sharedSuffix(raw);

  const rows = files.map((f, i) => {
    const fid   = pickField(f, ["id"], "");
    const full  = raw[i];
    let label   = full;
    if(pre && label.startsWith(pre)) label = label.slice(pre.length);
    if(suf && label.endsWith(suf) && label.length > suf.length) label = label.slice(0, -suf.length);

    // Per-file CRCs differ, so they survive the shared-suffix pass. Drop the
    // extension and any trailing bracketed metadata — the full name is still
    // on the element, and the episode number is what you are scanning for.
    label = label.replace(/\.(mkv|mp4|avi|m4v|webm|ts|ass|srt|sub|flac|mka|nfo|txt)$/i, "");
    let prev;
    do {
      prev = label;
      label = label.replace(/\s*[\[\(][^\]\)]*[\]\)]\s*$/, "");
    } while(label !== prev && label);

    label = label.trim() || full;

    const isVid = /^video\//.test(String(f.mimetype || ""));
    const size  = +pickField(f, ["size"], 0);
    const attrs = 'data-tid="' + esc(String(tid)) + '" data-fid="' + esc(String(fid)) +
                  '" data-name="' + esc(full) + '" data-folder="' + esc(torrentName) + '"';

    return '<div class="frow2">' +
      '<div class="fmain">' +
        '<div class="flabel">' + esc(label) + '</div>' +
        '<div class="fsize">' + esc(fmtBytes(size)) + '</div>' +
      '</div>' +
      (isVid ? '<button class="btn xplay" ' + attrs + '>Play</button>' : '') +
      '<button class="btn xdl" ' + attrs + ' title="Save">&#8595;</button>' +
    '</div>';
  }).join("");

  const vids = files.filter(f => /^video\//.test(String(f.mimetype || ""))).length;
  const summary = files.length + (files.length === 1 ? " file" : " files") +
                  (vids && vids !== files.length ? "  ·  " + vids + " video" : "");

  return '<details class="xfiles"><summary>' + summary + '</summary>' + rows + '</details>';
}

/* ====================================================================
   SEASON INTENT

   nyaa AND-matches your terms as substrings, so "re zero season 1"
   returns Season 4: "season" matches the word Season in the title and
   "1" matches 1080p. Both satisfied, wrong show entirely.

   So the season is taken out of the query before it is sent — it only
   adds noise there — and applied here instead, where titles are already
   being parsed.
   ==================================================================== */

const R_QSEASON = [
  /\bseasons?\s*(\d{1,2})\b/i,          // season 2, seasons 2
  /\b(\d{1,2})\s*(?:st|nd|rd|th)\s*season\b/i,  // 2nd season
  /\bs\s?(\d{1,2})\b(?!\s?e\s?\d)/i     // s2, s02 — but not s02e05
];

/** Pulls a season out of the query and returns the query without it. */
function parseQuery(raw){
  let q = String(raw || "").trim();
  let season = null;
  for(const re of R_QSEASON){
    const m = q.match(re);
    if(m){
      season = +m[1];
      q = (q.slice(0, m.index) + " " + q.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
      break;
    }
  }
  return {q: q || String(raw || "").trim(), season};
}

/**
 * Season of a release. Anime titles omit it for a first season far more
 * often than not, so no marker means season 1 — which is also what makes
 * filtering for season 1 useful at all.
 */
function parseSeason(title){
  const t = String(title || "").replace(/_/g, " ");
  let m = t.match(/\bS(\d{1,2})\s?E\s?\d{1,3}\b/i);        // S04E13
  if(m) return +m[1];
  m = t.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)\s+season\b/i); // 4th Season
  if(m) return +m[1];
  m = t.match(/\bseason\s*(\d{1,2})\b/i);                   // Season 4
  if(m) return +m[1];
  m = t.match(/\bS(\d{1,2})\b(?!\s?E)/i);                   // S2 - 10, S04
  if(m) return +m[1];
  return 1;
}

/* ====================================================================
   POSTERS

   nyaa gives filenames and nothing else — no metadata, no artwork. So
   the show has to be identified from the release name and looked up.
   AniList is free, needs no key, and returns the cover's dominant
   colour along with the image, which the cards use as an accent.

   Results are cached in localStorage permanently: a show's poster does
   not change, and this keeps repeat searches to zero requests.
   ==================================================================== */

const SHOW_CACHE_KEY = "nyaarank.shows";
let SHOW_CACHE = null;

function showCache(){
  if(SHOW_CACHE) return SHOW_CACHE;
  try{ SHOW_CACHE = JSON.parse(localStorage.getItem(SHOW_CACHE_KEY) || "{}"); }
  catch(e){ SHOW_CACHE = {}; }
  return SHOW_CACHE;
}
function saveShowCache(){
  try{ localStorage.setItem(SHOW_CACHE_KEY, JSON.stringify(SHOW_CACHE || {})); }
  catch(e){}
}

/* Everything from here on is technical noise, not part of the show's name. */
const R_CUT = new RegExp([
  '\\b(?:19|20)\\d{2}\\b',
  '\\b\\d{3,4}p\\b', '\\b\\d{3,4}x\\d{3,4}\\b',
  '\\b(?:bd|bdrip|bdmv|blu-?ray|web-?dl|web-?rip|web|hdtv|dvd(?:rip)?|remux)\\b',
  '\\b(?:x\\.?26[45]|h\\.?\\s?26[45]|hevc|avc|av1|vp9|xvid)\\b',
  '\\b(?:hi10p?|ma10p|10-?bits?|8-?bits?)\\b',
  '\\b(?:flac|aac|opus|ac3|eac3|dts|truehd|dual[\\s-]?audio|multi[\\s-]?audio)\\b',
  '\\b(?:multi[\\s-]?subs?|multiple\\s+subtitle|dub|sub(?:bed)?)\\b',
  '\\bS\\d{1,2}(?:\\s?E\\d{1,3})?\\b',
  '\\b\\d{1,2}(?:st|nd|rd|th)\\s+season\\b',
  '\\bseasons?\\s*\\d{1,2}\\b',
  '\\bbatch\\b', '\\bcomplete\\b',
  '\\((?:\\d{1,3})\\s*-\\s*(?:\\d{1,3})\\)',
  '\\bpart\\s*\\d\\b', '\\bv\\d\\b'
].join('|'), 'i');

/** Reduces a release name to something searchable. */
function showTitle(release){
  let t = String(release || "").replace(/_/g, " ");
  t = t.replace(/^\s*[\[\(][^\]\)]*[\]\)]\s*/, "");   // leading [group]
  t = t.split("|")[0];                                 // alt titles after a pipe

  const cut = t.search(R_CUT);
  if(cut > 0) t = t.slice(0, cut);
  const b = t.search(/[\[\(]/);
  if(b > 0) t = t.slice(0, b);

  t = t.replace(/\s*[-–—]\s*\d{1,3}\s*$/, "");         // trailing " - 08"
  t = t.replace(/\s*[-–—:~]\s*$/, "");
  return t.replace(/\s+/g, " ").trim();
}

const ANILIST_Q =
  "query($s:String){Media(search:$s,type:ANIME){id title{romaji english}" +
  "format seasonYear episodes averageScore coverImage{large color}}}";

async function anilistSearch(term){
  const r = await nativeRequest({
    method: "POST",
    url: "https://graphql.anilist.co",
    headers: {"Content-Type": "application/json", "Accept": "application/json"},
    body: {kind: "json", data: {query: ANILIST_Q, variables: {s: term}}}
  }, 20000);
  if(r.status !== 200) return null;
  const j = JSON.parse(r.body);
  return (j && j.data && j.data.Media) ? j.data.Media : null;
}

/**
 * Looks a show up, cascading to shorter queries on a miss — scene releases
 * drop punctuation ("Journeys" for "Journey's") which AniList will not match,
 * but the first word or two still finds it.
 */
async function lookupShow(release){
  const title = showTitle(release);
  if(!title) return null;

  const cache = showCache();
  const key = title.toLowerCase();
  if(cache[key] !== undefined) return cache[key];

  const words = title.split(" ");
  const tries = [title];
  if(words.length > 2) tries.push(words.slice(0, 2).join(" "));
  if(words.length > 1) tries.push(words[0]);

  let hit = null;
  for(const t of tries){
    try{ hit = await anilistSearch(t); }catch(e){ hit = null; }
    if(hit) break;
  }

  const val = hit ? {
    title: (hit.title.english || hit.title.romaji || title),
    img:   hit.coverImage ? hit.coverImage.large : "",
    color: (hit.coverImage && hit.coverImage.color) || "",
    year:  hit.seasonYear || "",
    format: hit.format || "",
    eps:   hit.episodes || 0,
    score: hit.averageScore || 0
  } : null;

  cache[key] = val;          // null is cached too: do not re-ask for a miss
  saveShowCache();
  return val;
}

/**
 * Fills in posters after the list is already on screen. Unique titles only —
 * a search for one show yields forty releases but one lookup.
 */
async function decoratePosters(root){
  if(!NATIVE) return;
  if(look().posters === "off") return;   // skip the network entirely
  const nodes = [...root.querySelectorAll("[data-show]")];
  const groups = {};
  for(const n of nodes){
    const k = showTitle(n.dataset.show).toLowerCase();
    if(!k) continue;
    (groups[k] = groups[k] || []).push(n);
  }

  for(const k of Object.keys(groups)){
    const info = await lookupShow(groups[k][0].dataset.show);
    if(!info || !info.img) continue;
    for(const n of groups[k]){
      const art = n.querySelector(".poster");
      if(!art) continue;
      art.style.backgroundImage = "url('" + info.img + "')";
      art.classList.add("has-art");
      if(info.color) n.style.setProperty("--accent", info.color);
      const meta = n.querySelector(".showmeta");
      if(meta){
        meta.textContent = [info.title, info.format, info.year,
                            info.eps ? info.eps + " eps" : ""]
                            .filter(Boolean).join("  ·  ");
      }
    }
  }
}

/* ====================================================================
   FILES — what is actually on this phone

   Separate from TorBox on purpose: that tab is a cloud queue, this one
   is Android's DownloadManager. They fail in different ways and you
   care about them at different times.
   ==================================================================== */

/* DownloadManager status constants */
const DL_PENDING = 1, DL_RUNNING = 2, DL_PAUSED = 4, DL_OK = 8, DL_FAIL = 16;

const DL_LABEL = {
  "-1": "queued", 1: "starting", 2: "downloading", 4: "paused",
  8: "saved", 16: "failed"
};

let dlTimer = null;

/**
 * Swaps in new markup without losing what the user had open.
 *
 * Both lists poll while something is active, and replacing innerHTML
 * destroys every expanded <details> and jumps the scroll — so an open
 * episode list snapped shut roughly once a second.
 */
function patchList(root, screenSel, html){
  const wasOpen = new Set(
    [...root.querySelectorAll(".xcard")]
      .filter(c => c.querySelector("details[open]"))
      .map(c => c.dataset.show || "")
  );
  const screen = $(screenSel);
  const y = screen ? screen.scrollTop : 0;

  root.innerHTML = html;

  for(const c of root.querySelectorAll(".xcard")){
    if(wasOpen.has(c.dataset.show || "")){
      const d = c.querySelector("details");
      if(d) d.open = true;
    }
  }
  if(screen) screen.scrollTop = y;
}

/* Mirrors safeName/safeFolder in MainActivity, so a file already queued can
   be recognised by the name DownloadManager actually stored. */
function dmName(s){
  const t = String(s || "").replace(/[\\/:*?"<>|\r\n]/g, "_").trim();
  return (t.length > 120 ? t.slice(0, 120) : t) || "nyaarank-download";
}
function dmFolder(s){
  const t = String(s || "").replace(/[\\/:*?"<>|\r\n]/g, "_")
                           .replace(/^[.\s]+/, "").trim();
  return t.length > 90 ? t.slice(0, 90).trim() : t;
}

/** Already saved, or already on its way. */
function alreadyQueued(name, folder){
  const n = dmName(name), f = dmFolder(folder);
  return localDownloads().some(d =>
    String(d.title || "") === n &&
    String(d.folder || "") === f &&
    (d.status === DL_OK || d.status === DL_RUNNING || d.status === DL_PENDING));
}

const DL_QUEUED = -1;

/* ---- speed and ETA ----
   DownloadManager exposes no speed, so it is measured: how far the byte
   count moved between two polls. A single sample jumps around on mobile,
   so it is smoothed, and the reading is dropped once a download ends. */
const SPEED = {};

function speedOf(d){
  const now = Date.now();
  const prev = SPEED[d.id];
  let rate = prev ? prev.rate : 0;

  if(prev && now > prev.t && d.done >= prev.b){
    const inst = (d.done - prev.b) / ((now - prev.t) / 1000);
    rate = rate ? rate * 0.65 + inst * 0.35 : inst;   // smooth, but still react
  }
  SPEED[d.id] = {b: d.done, t: now, rate: rate};
  return rate;
}

function forgetSpeed(id){ delete SPEED[id]; }

/** "3 min left", "1h 12m left", or "" when it cannot be known yet. */
function etaText(d, rate){
  if(!rate || rate < 1024 || !d.total || d.total <= d.done) return "";
  const secs = (d.total - d.done) / rate;
  if(secs < 45)   return Math.max(1, Math.round(secs)) + "s left";
  if(secs < 3600) return Math.round(secs / 60) + " min left";
  const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
  return h + "h " + (m ? m + "m " : "") + "left";
}

/** The waiting files themselves, shaped like DownloadManager rows. */
function queuedRows(){
  try{
    if(!NATIVE || !window.Nyaa.queueList) return [];
    return JSON.parse(window.Nyaa.queueList() || "[]").map(x => ({
      id: null, title: x.title, folder: x.folder,
      status: DL_QUEUED, done: 0, total: 0, reason: 0
    }));
  }catch(e){ return []; }
}

/** Files accepted but not yet handed to DownloadManager. */
function queuedCount(){
  try{ return (NATIVE && window.Nyaa.queued) ? window.Nyaa.queued() : 0; }
  catch(e){ return 0; }
}

function localDownloads(){
  try{
    if(!NATIVE || !window.Nyaa.downloads) return [];
    return JSON.parse(window.Nyaa.downloads() || "[]");
  }catch(e){ return []; }
}

/* Poll only while this tab is visible and something is moving. */
function startDlPoll(){
  stopDlPoll();
  dlTimer = setTimeout(() => {
    if(activeTab !== "downloads" || document.hidden){ stopDlPoll(); return; }
    renderDownloads();
  }, 1200);
}
function stopDlPoll(){
  if(dlTimer){ clearTimeout(dlTimer); dlTimer = null; }
}

/* ====================================================================
   BATCH SAVE
   ==================================================================== */

/**
 * Queues every video in a torrent at once. DownloadManager handles its own
 * concurrency, so these are simply enqueued back to back.
 */
function saveAll(btn){
  const card = btn.closest(".xcard");
  if(!card) return;
  const rows = [...card.querySelectorAll(".btn.xdl[data-fid]")];
  const vids = rows.filter(r => r.closest(".frow2") &&
                                r.closest(".frow2").querySelector(".xplay"));
  const targets = vids.length ? vids : rows;
  if(!targets.length) return;

  // Skip anything already saved or in flight, or a second tap silently
  // downloads the whole batch again alongside the first.
  const fresh = targets.filter(r => !alreadyQueued(r.dataset.name, r.dataset.folder));
  const skipped = targets.length - fresh.length;

  if(!fresh.length){
    btn.textContent = "Already saved";
    setTimeout(() => { btn.textContent = "Save all"; }, 2500);
    alertLine("All " + targets.length + " already saved or downloading");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Queued " + fresh.length;
  for(const r of fresh){
    try{
      saveFile(r.dataset.tid, r.dataset.fid, r.dataset.name, r.dataset.folder);
    }catch(e){}
  }
  $("#ddot").hidden = false;
  alertLine(fresh.length + (fresh.length === 1 ? " file" : " files") + " queued" +
            (skipped ? ", " + skipped + " already had" : "") + " — see the Files tab");
}

/* ====================================================================
   FILES, grouped by show

   A flat list of individual files was the wrong shape — you think in
   shows, not in downloads. So these are grouped by the folder each file
   was saved into, which is the release name, and given the same poster
   card treatment as the TorBox tab.
   ==================================================================== */

function renderDownloads(){
  const el = $("#dloads");
  try{ if(NATIVE && window.Nyaa.pump) window.Nyaa.pump(); }catch(e){}
  if(!NATIVE){
    el.innerHTML = '<div class="status">Downloads only exist in the Android app.</div>';
    return;
  }

  const list = localDownloads().concat(queuedRows());
  const active = list.filter(d => d.status === DL_RUNNING || d.status === DL_PENDING).length;
  const waiting = list.filter(d => d.status === DL_QUEUED).length;
  $("#ddot").hidden = !(active || waiting);

  if(!list.length && !waiting){
    $("#dcount").textContent = "";
    el.innerHTML = '<div class="status">Nothing saved yet.<br><br>' +
      'Open a finished torrent on the <b>TorBox</b> tab and tap <b>Save all</b>, ' +
      'or save single episodes with the ↓ button.</div>';
    stopDlPoll();
    return;
  }

  // group by the folder each file went into — that is the release name
  const groups = {};
  for(const d of list){
    const k = d.folder || "nyaarank";
    (groups[k] = groups[k] || []).push(d);
  }
  // episode order, not DownloadManager order
  for(const k of Object.keys(groups)){
    groups[k].sort((a, b) => String(a.title || "").localeCompare(
      String(b.title || ""), undefined, {numeric: true, sensitivity: "base"}));
  }
  const keys = Object.keys(groups).reverse();   // newest release first

  $("#dcount").textContent = keys.length + (keys.length === 1 ? " show" : " shows") +
                             (active ? " · " + active + " active" : "") +
                             (waiting ? " · " + waiting + " queued" : "");

  const html = keys.map(k => {
    const items = groups[k];
    const saved  = items.filter(d => d.status === DL_OK).length;
    const pend   = items.filter(d => d.status === DL_QUEUED).length;
    const stuck  = items.filter(d => d.status === DL_PAUSED).length;
    const busy   = items.filter(d => d.status === DL_RUNNING || d.status === DL_PENDING);
    const failed = items.filter(d => d.status === DL_FAIL).length;

    const totalBytes = items.reduce((a, d) => a + (d.total || 0), 0);
    const doneBytes  = items.reduce((a, d) => a + (d.done  || 0), 0);
    const pct = totalBytes > 0 ? Math.round(doneBytes / totalBytes * 100) : 0;

    const state = busy.length ? busy.length + " downloading" + (pend ? " · " + pend + " queued" : "")
                : stuck ? stuck + " paused" + (pend ? " · " + pend + " queued" : "")
                : pend ? pend + " queued"
                : failed && !saved ? failed + " failed"
                : failed ? saved + " saved · " + failed + " failed"
                : saved + (saved === 1 ? " episode" : " episodes");

    // shared prefix stripping, same as the TorBox file list
    const names = items.map(d => String(d.title || ""));
    const pre = sharedPrefix(names);

    const rows = items.map((d, i) => {
      let label = names[i];
      if(pre && label.startsWith(pre)) label = label.slice(pre.length);
      label = label.replace(/\.(mkv|mp4|avi|m4v|webm|ts)$/i, "");
      let prev;
      do { prev = label; label = label.replace(/\s*[\[\(][^\]\)]*[\]\)]\s*$/, ""); }
      while(label !== prev && label);
      label = label.trim() || names[i];

      const queued  = d.status === DL_QUEUED;
      const held    = d.status === DL_PAUSED;
      const running = d.status === DL_RUNNING || d.status === DL_PENDING;
      const ok = d.status === DL_OK;
      const bad = d.status === DL_FAIL;
      if(!running && d.id != null) forgetSpeed(d.id);   // stale once it stops
      const fpct = d.total > 0 ? Math.round(d.done / d.total * 100) : 0;

      return '<div class="frow2' + (queued ? " waiting" : "") + '">' +
        '<div class="fmain">' +
          '<div class="flabel">' + esc(label) + '</div>' +
          '<div class="fsize' + (bad ? " v-bad" : "") + '">' +
            (ok ? fmtBytes(d.done)
               : bad ? dlReason(d.reason)
               : held ? pauseReason(d.reason)
               : queued ? "queued"
               : running ? (() => {
                   const rate = speedOf(d);
                   const eta = etaText(d, rate);
                   return fpct + "%" +
                     (rate >= 1024 ? "  ·  " + fmtBytes(rate) + "/s" : "") +
                     (eta ? "  ·  " + eta : "");
                 })()
               : esc(DL_LABEL[d.status] || "")) +
          '</div>' +
          (running ? '<div class="bar mini"><i style="width:' + fpct + '%"></i></div>' : '') +
        '</div>' +
        (ok ? '<button class="btn xplay" data-open="' + esc(String(d.id)) + '">Play</button>' : '') +
        ((bad || held) ? '<button class="btn xretry1" data-retry="' + esc(String(d.id)) + '">Retry</button>' : '') +
        // a queued file has no DownloadManager id yet, so it is dropped by name
        (queued
          ? '<button class="btn xdl ddel" data-deq="' + esc(d.title) +
            '" data-deqf="' + esc(d.folder || "") + '">✕</button>'
          : '<button class="btn xdl ddel" data-dl="' + esc(String(d.id)) + '"' +
            ' data-running="' + (running ? "1" : "0") + '" data-label="' + esc(label) + '">' +
            (running ? "✕" : "🗑") + '</button>') +
      '</div>';
    }).join("");

    return '<div class="xcard" data-show="' + esc(k) + '">' +
      '<div class="xtop">' +
        '<div class="poster"></div>' +
        '<div class="xhead">' +
          '<div class="showmeta"></div>' +
          '<div class="xname">' + esc(k) + '</div>' +
          '<div class="xmeta">' +
            '<span class="' + (busy.length ? "" : failed && !saved ? "v-bad" : "v-good") + '">' +
              esc(state) + '</span>' +
            '<span>' + esc(fmtBytes(doneBytes)) + '</span>' +
          '</div>' +
          (busy.length ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : '') +
        '</div>' +
      '</div>' +
      '<details class="xfiles"><summary>' + items.length +
        (items.length === 1 ? " file" : " files") + '</summary>' + rows + '</details>' +
      '<div class="xacts">' +
        (failed ? '<button class="btn xall" data-retryall="' +
          esc(items.filter(d => d.status === DL_FAIL).map(d => d.id).join(",")) +
          '">Retry ' + failed + ' failed</button>' : '') +
        '<button class="btn xdel" data-delall="' +
          esc(items.map(d => d.id).join(",")) + '" data-show="' + esc(k) + '">' +
          'Delete all ' + items.length + '</button>' +
      '</div>' +
    '</div>';
  }).join("");

  // queued files are listed in place now, so no separate note is needed
  patchList(el, "#scr-downloads", html);
  decoratePosters(el);
  const held = list.filter(d => d.status === DL_PAUSED).length;
  if(active || waiting || held) startDlPoll(); else stopDlPoll();
}

/* Delete removes the file from the phone, so it asks first — the same
   two-tap pattern as the TorBox remove, for the same reason. */
$("#dloads").addEventListener("click", async e => {
  const open = e.target.closest("[data-open]");
  if(open){
    try{ window.Nyaa.openDownload(open.dataset.open); }catch(err){ alertLine(String(err)); }
    return;
  }

  // delete every file in one release
  const grp = e.target.closest("[data-delall]");
  if(grp){
    const ids = String(grp.dataset.delall).split(",").filter(Boolean);
    const show = grp.dataset.show || "this release";
    const ok = await confirmDialog({
      title: "Delete " + ids.length + (ids.length === 1 ? " file" : " files") + "?",
      body: "This removes them from your phone, not just from this list.<br><br>" +
            "<b>" + esc(show) + "</b>",
      yes: "Delete " + ids.length
    });
    if(!ok) return;
    for(const id of ids){
      try{ window.Nyaa.cancelDownload(id); }catch(err){}
    }
    renderDownloads();
    return;
  }

  // dropping something that has not started needs no confirmation:
  // nothing has been downloaded and nothing is deleted
  const dq = e.target.closest("[data-deq]");
  if(dq){
    try{ window.Nyaa.dequeue(dq.dataset.deq, dq.dataset.deqf || ""); }catch(err){}
    renderDownloads();
    return;
  }

  const one = e.target.closest("[data-retry]");
  if(one){
    const d = localDownloads().filter(x => String(x.id) === one.dataset.retry)[0];
    if(!d || !retryOne(d))
      alertLine("Can't retry that one — save it again from the TorBox tab");
    renderDownloads();
    return;
  }

  const many = e.target.closest("[data-retryall]");
  if(many){
    const ids = String(many.dataset.retryall).split(",").filter(Boolean);
    const all = localDownloads();
    let done = 0;
    for(const id of ids){
      const d = all.filter(x => String(x.id) === id)[0];
      if(d && retryOne(d)) done++;
    }
    alertLine(done ? "Retrying " + done + (done === 1 ? " file" : " files")
                   : "Can't retry these — save them again from the TorBox tab");
    renderDownloads();
    return;
  }

  const b = e.target.closest("[data-dl]");
  if(!b) return;

  const running = b.dataset.running === "1";
  const ok = await confirmDialog({
    title: running ? "Cancel this download?" : "Delete this file?",
    body: running
      ? "It will stop and the partial file is discarded.<br><br><b>" + esc(b.dataset.label || "") + "</b>"
      : "This removes it from your phone, not just from this list.<br><br><b>" +
        esc(b.dataset.label || "") + "</b>",
    yes: running ? "Cancel download" : "Delete"
  });
  if(!ok) return;

  try{ window.Nyaa.cancelDownload(b.dataset.dl); }catch(err){}
  renderDownloads();
});

/* ====================================================================
   CONFIRM

   The two-tap pattern could not survive these screens: both lists poll
   while something is active and re-render, which destroyed the armed
   button between the first tap and the second.

   A sheet lives outside the list, so a refresh cannot disturb it.
   window.confirm() is not an option — a WebView with no WebChromeClient
   suppresses it silently and returns false.
   ==================================================================== */

let pendingConfirm = null;

function closeSheet(){
  $("#scrim").hidden = true;
  $("#sheet").hidden = true;
  $("#sheetbody").innerHTML = "";
  if(pendingConfirm){
    const r = pendingConfirm;
    pendingConfirm = null;
    r(false);
  }
}

/** Resolves true only if the user actively confirms. */
function confirmDialog(o){
  return new Promise(resolve => {
    pendingConfirm = resolve;

    $("#sheetbody").innerHTML =
      '<h3 class="lbl">' + esc(o.title) + '</h3>' +
      '<p class="cfm-body">' + o.body + '</p>' +
      '<button class="btn-big danger" id="cfmYes">' + esc(o.yes || "Delete") + '</button>' +
      '<button class="btn-ghost" id="cfmNo">Cancel</button>';

    $("#scrim").hidden = false;
    $("#sheet").hidden = false;

    const finish = v => {
      pendingConfirm = null;
      $("#scrim").hidden = true;
      $("#sheet").hidden = true;
      $("#sheetbody").innerHTML = "";
      resolve(v);
    };
    $("#cfmYes").onclick = () => finish(true);
    $("#cfmNo").onclick  = () => finish(false);
  });
}

/* ====================================================================
   RETRY

   DownloadManager keeps no memory of what a download was for, so a
   failed file cannot be re-requested from its row alone. Every enqueue
   records which torrent and file it came from, keyed by the sanitised
   name DownloadManager actually stores, so a retry can build a fresh
   link — fresh matters, because the token may have changed since.
   ==================================================================== */

const DLMAP_KEY = "nyaarank.dlmap";

function dlMap(){
  try{ return JSON.parse(localStorage.getItem(DLMAP_KEY) || "{}"); }
  catch(e){ return {}; }
}
function dlMapPut(name, folder, tid, fid){
  try{
    const m = dlMap();
    m[dmName(name) + "|" + dmFolder(folder)] = {t: String(tid), f: String(fid)};
    localStorage.setItem(DLMAP_KEY, JSON.stringify(m));
  }catch(e){}
}
function dlMapGet(title, folder){
  return dlMap()[String(title || "") + "|" + String(folder || "")] || null;
}

/** Enqueue, and remember what it was, so it can be retried later. */
function saveFile(tid, fid, name, folder){
  dlMapPut(name, folder, tid, fid);
  window.Nyaa.download(dlUrl(tid, fid), name || "", folder || "");
}

/** True if the retry was actually started. */
function retryOne(d){
  const rec = dlMapGet(d.title, d.folder);
  if(!rec) return false;
  try{ window.Nyaa.cancelDownload(String(d.id)); }catch(e){}   // clear the failed row
  try{
    dlMapPut(d.title, d.folder, rec.t, rec.f);
    // Front of the queue. It was already in progress, and sending it to the
    // back of eighteen others is what shuffled a season into a random order.
    window.Nyaa.downloadNext(dlUrl(rec.t, rec.f), d.title, d.folder);
  }catch(e){ return false; }
  return true;
}

/**
 * DownloadManager reports an HTTP status directly when the server refused,
 * and its own constants otherwise. "code 502" tells you nothing; "server
 * error 502" at least says whose fault it was.
 */
/**
 * A paused download reports why, and the codes mean something different
 * from the failure codes — 1 is "waiting to retry" here and "storage
 * error" there, so status has to pick the table.
 *
 * There is no public resume API: Android restarts these itself once the
 * condition clears. Retry re-queues from scratch, which is the only way
 * out of one that never does.
 */
function pauseReason(code){
  return {
    1: "waiting to retry",
    2: "waiting for a connection",
    3: "waiting for wi-fi",
    4: "paused by the system"
  }[code] || "paused";
}

function dlReason(code){
  const own = {
    1001: "storage error",
    1002: "unexpected server response",
    1004: "network error",
    1005: "too many redirects",
    1006: "not enough space",
    1007: "no storage found",
    1008: "could not resume",
    1009: "file already exists"
  };
  if(own[code]) return own[code];
  if(code >= 500 && code < 600) return "server error " + code;
  if(code >= 400 && code < 500) return "rejected " + code;
  return code ? "error " + code : "failed";
}

/* ====================================================================
   APPEARANCE

   Themes are only a redefinition of the custom properties in app.css,
   so switching one is a single attribute on <html> — no re-render and
   nothing for the rest of the app to know about.

   Layout variants are deliberately limited to density and posters
   rather than alternative screens: parallel renderers would double the
   maintenance of every list, and every list here has already had a bug
   fixed in one copy and missed in the other.
   ==================================================================== */

const THEMES = [
  {id: "",         name: "nyaarank", dots: ["#e85d9e", "#f2b441", "#4fd2c2", "#12131a"]},
  {id: "midnight", name: "Midnight", dots: ["#5aa9f0", "#e0b256", "#4fd6b0", "#0a0c10"]},
  {id: "sakura",   name: "Sakura",   dots: ["#f2789f", "#f0b27a", "#7fd6c0", "#17111a"]},
  {id: "terminal", name: "Terminal", dots: ["#4ee06a", "#d8c65a", "#5ad8c0", "#080a08"]},
  {id: "paper",    name: "Paper",    dots: ["#8f2d1e", "#7a5f16", "#231f19", "#e6e0d3"]}
];

const LOOK_KEY = "nyaarank.look";

function look(){
  try{ return JSON.parse(localStorage.getItem(LOOK_KEY) || "{}"); }
  catch(e){ return {}; }
}
function applyLook(v){
  const el = document.documentElement;
  if(v.theme) el.setAttribute("data-theme", v.theme); else el.removeAttribute("data-theme");
  el.setAttribute("data-density", v.density || "comfortable");
  el.setAttribute("data-posters", v.posters === "off" ? "off" : "on");
}
function saveLook(v){
  try{ localStorage.setItem(LOOK_KEY, JSON.stringify(v)); }catch(e){}
  applyLook(v);
}

/* applied before first paint below, so there is no flash of the default */
applyLook(look());

function renderAppearance(){
  const v = look();
  const swatches = THEMES.map(t =>
    '<button class="swatch" data-theme-id="' + esc(t.id) + '"' +
      ' aria-pressed="' + ((v.theme || "") === t.id) + '">' +
      '<span class="dots">' +
        t.dots.map(c => '<i style="background:' + esc(c) + '"></i>').join("") +
      '</span>' + esc(t.name) +
    '</button>').join("");

  return '<div class="acard">' +
    '<h3>Appearance</h3>' +
    '<div class="themes">' + swatches + '</div>' +

    '<div class="frow" style="margin:14px 0 8px">' +
      '<label>Density</label>' +
      '<div class="seg" id="segDensity">' +
        '<button data-den="comfortable" aria-pressed="' + ((v.density || "comfortable") === "comfortable") + '">Comfortable</button>' +
        '<button data-den="compact" aria-pressed="' + (v.density === "compact") + '">Compact</button>' +
      '</div>' +
    '</div>' +

    '<div class="frow" style="margin:0 0 4px">' +
      '<label>Posters</label>' +
      '<div class="seg" id="segPosters">' +
        '<button data-pos="on" aria-pressed="' + (v.posters !== "off") + '">Show</button>' +
        '<button data-pos="off" aria-pressed="' + (v.posters === "off") + '">Hide</button>' +
      '</div>' +
    '</div>' +
    '<p class="hint" style="margin:6px 0 0">Hiding posters skips the artwork lookup ' +
      'entirely — useful on mobile data.</p>' +
  '</div>';
}

function wireAppearance(){
  const themes = $(".themes");
  if(themes) themes.onclick = e => {
    const b = e.target.closest("[data-theme-id]");
    if(!b) return;
    const v = look(); v.theme = b.dataset.themeId;
    saveLook(v);
    renderSettings();
  };
  const den = $("#segDensity");
  if(den) den.onclick = e => {
    const b = e.target.closest("[data-den]");
    if(!b) return;
    const v = look(); v.density = b.dataset.den;
    saveLook(v);
    renderSettings();
  };
  const pos = $("#segPosters");
  if(pos) pos.onclick = e => {
    const b = e.target.closest("[data-pos]");
    if(!b) return;
    const v = look(); v.posters = b.dataset.pos;
    saveLook(v);
    renderSettings();
  };
}

/* Settings is painted last: it reads THEMES, which is a const in the
   appearance module and therefore not initialised until this point. */
renderSettings();

/* ====================================================================
   LANDING

   The old empty state explained the ranking model to someone who had
   not asked yet. What you actually want on opening the app is a way to
   start, so: your recent searches as buttons, and a few shows to tap if
   there are none.
   ==================================================================== */

const RECENT_KEY = "nyaarank.recent";

function recentSearches(){
  try{ return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch(e){ return []; }
}
function rememberSearch(q){
  q = String(q || "").trim();
  if(!q) return;
  try{
    const list = recentSearches().filter(x => x.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  }catch(e){}
}
function forgetSearches(){
  try{ localStorage.removeItem(RECENT_KEY); }catch(e){}
  renderLanding();
}

function renderLanding(){
  $("#scr-search").classList.add("home");
  const recent = recentSearches();

  // Nothing but the search itself unless there is history worth offering.
  out.innerHTML = recent.length
    ? '<div class="landing">' +
        '<h3 class="lbl">Recent</h3>' +
        '<div class="chips">' +
          recent.map(q => '<button class="chip" data-q="' + esc(q) + '">' +
                          esc(q) + '</button>').join("") +
        '</div>' +
        '<button class="linky" id="clearRecent">Clear recent</button>' +
      '</div>'
    : '';

  const cr = $("#clearRecent");
  if(cr) cr.onclick = forgetSearches;
}

out.addEventListener("click", e => {
  const c = e.target.closest(".chip");
  if(!c) return;
  $("#q").value = c.dataset.q;
  run();
});

renderLanding();
