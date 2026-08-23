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

  s += Math.min(20, 7 * Math.log10(it.seeders + 1));
  if(it.seeders === 0){ s -= 25; why.push(["bad","dead — zero seeders"]); }
  else if(it.seeders < 3) why.push(["bad", "only " + it.seeders + " seeder(s), expect a crawl"]);

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
    }, timeoutMs || 25000);
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

function render(items, q){
  RESULTS = items;
  $("#hcount").textContent = items.length ? items.length + " ranked" : "";
  if(!items.length){
    out.innerHTML = `<div class="status">Nothing for “${esc(q)}”.<br><br>
      Try the romaji title — nyaa indexes what uploaders typed, so
      “Sousou no Frieren” finds more than “Frieren”.</div>`;
    return;
  }
  out.innerHTML = items.map((it, i) => {
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
  const q = $("#q").value.trim(); if(!q) return;
  $("#btn").disabled = true; $("#q").blur();
  out.innerHTML = `<div class="status"><span class="spin"></span>Searching nyaa…</div>`;
  try{
    const raw = await fetchNyaa(q, "1_2", opts.trusted ? "2" : "0");
    raw.forEach(it => scoreItem(it, opts));
    raw.sort((a,b) => b.score - a.score);
    render(raw.slice(0, 40), q);
  }catch(err){
    $("#hcount").textContent = "";
    out.innerHTML = `<div class="status err"><b>Couldn't reach nyaa.si</b>
      Every relay failed. Usually one of three things: the free CORS relays are
      down, your ISP blocks nyaa (a VPN fixes that), or this preview frame blocks
      outside requests — in that case save this file and open it in Chrome or Safari.
      <code>${esc(err.message || err)}</code></div>`;
  }
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
                 account:"#scr-account", settings:"#scr-settings"};
let activeTab = "search";

function showTab(name){
  if(!SCREENS[name]) return;
  activeTab = name;
  for(const [k, sel] of Object.entries(SCREENS)) $(sel).hidden = (k !== name);
  for(const b of $("#tabbar").children)
    b.setAttribute("aria-pressed", String(b.dataset.tab === name));
  if(name === "account") refreshAccount();   // on focus, not on a timer
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
function closeSheet(){
  $("#scrim").hidden = true;
  $("#sheet").hidden = true;
  $("#sheetbody").innerHTML = "";
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

function renderAccount(d){
  const who      = pickField(d, ["email","username","name"], "Signed in");
  const planRaw  = pickField(d, ["plan","plan_name","subscription_plan"], "");
  const planLabel = String(planRaw) === "0" ? "free"
                  : (String(planRaw).toLowerCase() || "unknown");
  const used     = +pickField(d, ["total_downloaded","monthly_downloaded","bandwidth_used"], 0);
  const limit    = +pickField(d, ["total_bytes_limit","monthly_limit","bandwidth_limit"], 0);
  const active   = pickField(d, ["active_downloads","current_active_downloads"], null);
  const expires  = pickField(d, ["premium_expires_at","expires_at","plan_expires_at"], null);
  const cooldown = pickField(d, ["cooldown_until"], null);

  let usageHtml = "";
  if(limit > 0){
    const pct = Math.min(100, Math.round(used / limit * 100));
    const cls = pct >= 95 ? "full" : (pct >= 75 ? "warn" : "");
    usageHtml =
      '<div class="acard">' +
        '<h3>Bandwidth this period</h3>' +
        '<div class="bar ' + cls + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="stat"><span class="k">' + pct + '% used</span>' +
          '<span class="v">' + esc(fmtBytes(used)) + ' / ' + esc(fmtBytes(limit)) + '</span></div>' +
      '</div>';
  }

  // A date in the past means the opposite of what the label would imply:
  // an expiry that has passed is "premium ended", and a cooldown that has
  // passed is no cooldown at all. Label by which side of now it falls on,
  // and drop a stale cooldown entirely rather than implying one is active.
  const now = Date.now();
  const expTs  = expires  ? Date.parse(expires)  : NaN;
  const coolTs = cooldown ? Date.parse(cooldown) : NaN;
  const day = t => new Date(t).toISOString().slice(0, 10);
  const minute = t => new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const rows =
    (active !== null
      ? '<div class="stat"><span class="k">Active downloads</span><span class="v">' + esc(String(active)) + '</span></div>' : '') +
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
    '<p class="hint">Android will ask permission to install from nyaarank the ' +
      'first time. The download continues in the notification shade.</p>';

  $("#doUp").onclick = () => {
    try{
      window.Nyaa.installUpdate(rel.url);
      $("#doUp").disabled = true;
      $("#doUp").textContent = "Downloading…";
    }catch(e){
      slot.innerHTML = '<p class="err-txt">' + esc(String(e)) + '</p>';
    }
  };
}

renderSettings();
