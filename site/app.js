/* Receipts — everything computed in the browser from data/data.json */
import { setProgress, hideLoader, startMotion, scrollTo, lockScroll, wipeTo } from "./motion.js";
import { DOW, fmtH, dateOf, dayOf, fmtD, fmtM, yearOf, monthKey, num, inr, pct, esc } from "./util.js";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const COLOR = { music: "var(--music)", spend: "var(--spend)", card: "var(--card)" };
const SRC_LABEL = { music: "Music", spend: "Spend", card: "Card" };

let D, R = [], byDay = new Map(), artistStats = new Map();

(async () => {
  const res = await fetch("data/data.json"), total = +res.headers.get("content-length") || 6.1e6, reader = res.body.getReader(), chunks = [];
  let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; setProgress(got / total); }
  const buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  setProgress(1);
  init(JSON.parse(new TextDecoder().decode(buf)));
})();

// ---------- unify ----------
function spendType(cat, sub) {
  const c = (cat + " " + sub).toLowerCase();
  if (/movie|netflix|tata sky|culture|books|hbr|newspaper|entertain/.test(c)) return "Entertainment";
  if (/transport|travel|train|auto|taxi|bus|bike|fuel|petrol/.test(c)) return "Places";
  if (/festival|gift|farewell|diwali|holi|navratri|ganesh|raksha/.test(c)) return "Events";
  if (/health|medicine|hospital|doctor|fitness/.test(c)) return "Health";
  if (/salary|invest|fund|deposit|provident|share|dividend|interest|transfer|saving|insurance|maturity|tax|bonus|reward|loan|rd\b/.test(c)) return "Money";
  if (/family|maid|pocket/.test(c)) return "Family";
  return "Purchases";
}
const cardType = c => ({ travel: "Places", entertainment: "Entertainment", fitness_and_medical: "Health", online_shopping: "Purchases" }[c] || "Purchases");

function build() {
  const MONEY = /invest|fund|deposit|provident|share|money transfer|saving|insurance|recurring|emi/i;
  D.spend.forEach((s, i) => R.push({ id: "s" + i, src: "spend", d: s.d, h: s.h, type: spendType(s.cat, s.sub), title: s.note || s.sub || s.cat, sub: [s.cat, s.sub, s.mode].filter(Boolean).join(" · "), amt: s.amt, kind: s.kind === "Expense" && MONEY.test(s.cat) ? "Transfer-Out" : s.kind, ref: s }));
  D.card.forEach((c, i) => R.push({ id: "c" + i, src: "card", d: c.d, h: c.h, type: cardType(c.cat), title: c.merchant || "Unnamed merchant", sub: [c.cat?.replace(/_/g, " "), c.city, c.state].filter(Boolean).join(" · ") || "no details recorded", amt: c.amt, fraud: c.fraud, ref: c }));
  D.plays.forEach((p, i) => { const t = D.tracks[p[2]]; R.push({ id: "m" + i, src: "music", d: p[0], h: p[1], type: "Music", title: t[0], sub: t[1] + " · " + t[2], sec: p[3], plat: D.platforms[p[4]], skip: p[5], artist: t[1], track: p[2] }); });
  R.sort((a, b) => a.d - b.d || (a.h ?? 12) - (b.h ?? 12));
  for (const r of R) {
    r.q = (r.title + " " + r.sub + " " + r.type).toLowerCase();
    if (!byDay.has(r.d)) byDay.set(r.d, []);
    byDay.get(r.d).push(r);
    if (r.src === "music") {
      const a = artistStats.get(r.artist) || { n: 0, first: r.d, years: {} };
      a.n++; a.years[yearOf(r.d)] = (a.years[yearOf(r.d)] || 0) + 1; artistStats.set(r.artist, a);
    }
  }
}

function init(data) {
  D = data; build();
  hero(); gallery(); journey(); chapters(); charts(); explorer(); sectionPics(); marquee();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(charts, 250); });
  polish(); startMotion(); hideLoader();
  const m = location.hash.match(/day=(\d{4}-\d{2}-\d{2})/); if (m) openDay(dayOf(m[1]));
  const mm = location.hash.match(/moment=(\d+)/); if (mm) openPin(+mm[1] - 1);
}

// ---------- polish: scroll progress, active nav link, reveal-on-scroll ----------
function polish() {
  // sideways chapter lists: drag to scroll with a mouse (trackpad and touch scroll natively)
  $$(".chapter .items").forEach(el => {
    let x0 = null, s0 = 0, moved = false;
    el.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") return; x0 = e.clientX; s0 = el.scrollLeft; moved = false; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", e => { if (x0 == null) return; const dx = e.clientX - x0; if (Math.abs(dx) > 6) moved = true; el.scrollLeft = s0 - dx; });
    el.addEventListener("pointerup", () => { x0 = null; });
    el.addEventListener("click", e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  });
  const bar = $("#progress"), links = [...document.querySelectorAll(".nav .links a")];
  addEventListener("scroll", () => { const h = document.documentElement; bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + "%"; }, { passive: true });
  const secs = links.map(a => $(a.getAttribute("href"))).filter(Boolean);
  const nav = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id)); }, { rootMargin: "-40% 0px -55% 0px" });
  secs.forEach(sc => nav.observe(sc));
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => { const t = $(a.getAttribute("href")); if (t) { e.preventDefault(); a.dataset.wipe != null ? wipeTo(t, a.dataset.wipe) : scrollTo(t); } }));
  $("#drawer").addEventListener("close", () => lockScroll(false));
}

// ---------- marquee: a ticker of real receipts ----------
function sectionPics() {
  // rhythms: a clock face of plays by hour; hover an hour for its count, the hand sweeps with scroll
  const hrs = Array(24).fill(0); for (const r of R) if (r.src === "music") hrs[r.h]++;
  const mx = Math.max(...hrs), C = 110;
  const bars = hrs.map((n, h) => { const a = (h / 24) * Math.PI * 2 - Math.PI / 2, r0 = 54, r1 = 54 + (n / mx) * 46; return `<line class="hr" data-h="${h}" x1="${C + Math.cos(a) * r0}" y1="${C + Math.sin(a) * r0}" x2="${C + Math.cos(a) * r1}" y2="${C + Math.sin(a) * r1}" stroke="${h >= 23 || h < 5 ? "#4a3aa7" : "#2a78d6"}" stroke-width="7" stroke-linecap="round"/>`; }).join("");
  $("#pic-rhythms").innerHTML = `<div class="pic frame" style="--x:0;--y:0"><div class="pic-in"><svg viewBox="0 0 220 220" width="220" height="220" aria-hidden="true"><circle cx="${C}" cy="${C}" r="104" fill="none" stroke="#e1dfd8"/>${bars}${[0, 6, 12, 18].map(h => { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; return `<text x="${C + Math.cos(a) * 36}" y="${C + Math.sin(a) * 36 + 3}" text-anchor="middle" font-size="9" font-family="JetBrains Mono" fill="#66746d">${h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? h + "am" : h - 12 + "pm"}</text>`; }).join("")}<line id="clock-hand" x1="${C}" y1="${C}" x2="${C}" y2="${C - 100}" stroke="#022016" stroke-width="2" stroke-linecap="round"/><circle cx="${C}" cy="${C}" r="4" fill="#022016"/></svg><span>plays by hour of day · 2013 → 2024</span></div></div>`;
  $$("#pic-rhythms .hr").forEach(l => hover(l, `<b>${fmtH(+l.dataset.h)}</b> · ${num(hrs[+l.dataset.h])} plays`));
  // places: a postcard stamped with the cities the card was swiped in (verified only)
  const cities = new Map(); for (const r of R) if (r.src === "card" && r.fraud === 0 && r.ref.city) cities.set(r.ref.city, (cities.get(r.ref.city) || 0) + 1);
  const top = [...cities].sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("#pic-places").innerHTML = `<div class="pic postcard" style="--x:0;--y:0"><div class="pic-in"><div class="stamp"><b>${esc(top[0]?.[0] || "")}</b><small>${top[0]?.[1] || 0} transactions</small></div><div class="mark" aria-hidden="true">VERIFIED<br>2022–24</div><small>GREETINGS FROM</small><div class="stack">${top.slice(1).map(([c, n]) => `<button type="button" data-q="${esc(c)}">${esc(c)} <i>${n}</i></button>`).join("")}</div><span>Select a city to view its transactions</span></div></div>`;
  // explorer: slips with searches worth trying
  const tries = ["Beatles", "Domino's", "Diwali", "Netflix"].map(q => [q, R.filter(r => r.q.includes(q.toLowerCase())).length]);
  $("#pic-explorer").innerHTML = tries.map(([q, n], i) => `<button type="button" class="pic slip" data-q="${esc(q)}" style="--x:${i * 14}%;--y:${i * 20}%;--r:${-3 + i * 2}deg" aria-label="Search ${esc(q)}"><div class="pic-in"><b>${esc(q)}</b><span>${num(n)} receipts →</span></div></button>`).join("");
  $$("#pic-places [data-q], #pic-explorer [data-q]").forEach(b => b.addEventListener("click", () => searchExplorer(b.dataset.q)));
}
function marquee() {
  const items = [];
  for (const [ds] of PINS) { const d = dayOf(ds), s = daySummary(d), sp = [...s.spend].sort((a, b) => b.amt - a.amt)[0]; if (sp) items.push(["spend", `${sp.title} · ${inr(sp.amt)}`]); if (s.artists[0]) items.push(["music", `${s.artists[0][0]} ×${s.artists[0][1]} · ${fmtD(d)}`]); }
  [...artistStats].sort((a, b) => b[1].n - a[1].n).slice(0, 6).forEach(([a, st]) => items.push(["music", `${a} · ${num(st.n)} plays`]));
  D.card.filter(c => c.fraud === 0 && c.merchant && c.city).sort((a, b) => b.amt - a.amt).slice(0, 5).forEach(c => items.push(["card", `${c.merchant}, ${c.city} · ${inr(c.amt)}`]));
  const html = items.map(([c, t]) => `<span class="mq ${c}">${esc(t)}</span>`).join("");
  $("#marquee-track").innerHTML = html + html;
}

// ---------- tiny svg helper ----------
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, kids = []) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) { if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
  for (const k of kids) e.appendChild(k);
  return e;
}
const tip = $("#tip");
function showTip(ev, html) { tip.innerHTML = html; tip.hidden = false; moveTip(ev); }
function moveTip(ev) { const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.min(ev.clientX + 14, innerWidth - w - 8) + "px"; tip.style.top = Math.min(ev.clientY + 14, innerHeight - h - 8) + "px"; }
function hideTip() { tip.hidden = true; }
const text = html => html.replace(/<br\s*\/?>/g, ", ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
function pressable(node, fn, label) {
  node.setAttribute("tabindex", "0"); node.setAttribute("role", "button"); node.setAttribute("aria-label", label);
  node.addEventListener("click", fn);
  node.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
}
function hover(node, html) {
  if (typeof html === "string") { node.setAttribute("role", "img"); node.setAttribute("aria-label", text(html)); } node.addEventListener("mouseenter", e => showTip(e, typeof html === "function" ? html() : html)); node.addEventListener("mousemove", moveTip); node.addEventListener("mouseleave", hideTip); }

// ---------- stats over a day range ----------
function stats(d0, d1) {
  const s = { plays: 0, sec: 0, night: 0, skips: 0, newPlays: 0, plats: new Map(), artists: new Map(), spendN: 0, expense: 0, income: 0, invest: 0, cash: 0, exN: 0, cats: new Map(), cardN: 0, cardAmt: 0, fraud: 0, cities: new Set(), newArtists: [] };
  for (const r of R) {
    if (r.d < d0) continue; if (r.d > d1) break;
    if (r.src === "music") { s.plays++; s.sec += r.sec; if (r.h >= 23 || r.h < 5) s.night++; if (r.skip) s.skips++; if (artistStats.get(r.artist).first >= d0) s.newPlays++; s.plats.set(r.plat, (s.plats.get(r.plat) || 0) + 1); s.artists.set(r.artist, (s.artists.get(r.artist) || 0) + 1); }
    else if (r.src === "spend") {
      s.spendN++;
      if (r.kind === "Expense") { s.expense += r.amt; s.exN++; if (r.ref.mode === "Cash") s.cash++; s.cats.set(r.ref.cat, (s.cats.get(r.ref.cat) || 0) + r.amt); }
      else if (r.kind === "Income") s.income += r.amt; else s.invest += r.amt;
    } else { s.cardN++; s.cardAmt += r.amt; if (r.fraud === 1) s.fraud++; if (r.ref.city) s.cities.add(r.ref.city); }
  }
  s.top = [...s.artists].sort((a, b) => b[1] - a[1]).slice(0, 3);
  s.topCats = [...s.cats].sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [a, st] of artistStats) if (st.first >= d0 && st.first <= d1 && st.n >= 150) s.newArtists.push([a, st.n]);
  s.newArtists.sort((a, b) => b[1] - a[1]);
  return s;
}
function daySummary(d) {
  const rs = byDay.get(d) || [];
  const m = rs.filter(r => r.src === "music"), sp = rs.filter(r => r.src === "spend"), c = rs.filter(r => r.src === "card");
  const tracks = new Map(), artists = new Map();
  for (const r of m) { tracks.set(r.track, (tracks.get(r.track) || 0) + 1); artists.set(r.artist, (artists.get(r.artist) || 0) + 1); }
  return { music: m, spend: sp, card: c, sec: m.reduce((a, r) => a + r.sec, 0), tracks: [...tracks].sort((a, b) => b[1] - a[1]), artists: [...artists].sort((a, b) => b[1] - a[1]), hours: m.length ? [Math.min(...m.map(r => r.h)), Math.max(...m.map(r => r.h))] : null };
}

// ---------- hero ----------
function hero() {
  const hrs = D.plays.reduce((a, p) => a + p[3], 0) / 3600;
  const ex = D.spend.filter(s => s.kind === "Expense").reduce((a, s) => a + s.amt, 0);
  const ct = D.card.reduce((a, c) => a + c.amt, 0);
  const line = (l, n, c, pre = "") => `<div class="rc-line ${c}"><span>${l}</span><span class="dots" aria-hidden="true"></span><b data-n="${Math.round(n)}" data-pre="${pre}">${pre}0</b></div>`;
  $("#hero-tiles").innerHTML = `<div class="rc-head"><b>RECEIPTS</b><span>LIFE EXPORT · 3 SOURCES</span><span>${fmtD(R[0].d).toUpperCase()} → ${fmtD(R[R.length - 1].d).toUpperCase()}</span></div>
    ${line("MUSIC PLAYS", D.plays.length, "music")}${line("HOURS LISTENED", hrs, "music")}${line("EXPENSES LOGGED", D.spend.length, "spend")}${line("RUPEES SPENT", ex, "spend", "₹")}${line("CARD SWIPES", D.card.length, "card")}${line("RUPEES SWIPED", ct, "card", "₹")}
    <div class="rc-line rc-total"><span>TOTAL RECEIPTS</span><span class="dots" aria-hidden="true"></span><b data-n="${R.length}" data-pre="">0</b></div>
    <div class="rc-bar" aria-hidden="true"></div><div class="rc-foot">THANK YOU FOR LIVING · NO REFUNDS</div>`;
  const els = [...$("#hero-tiles").querySelectorAll("[data-n]")], t0 = performance.now(), dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400;
  (function tick(t) { const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); for (const b of els) b.textContent = b.dataset.pre + num(+b.dataset.n * e); if (k < 1) requestAnimationFrame(tick); })(t0);
}

// ---------- hero gallery: "pictures" generated from the receipts ----------
function gallery() {
  const top = [...artistStats].sort((a, b) => b[1].n - a[1].n)[0];
  const movie = R.find(r => r.src === "spend" && /batman/i.test(r.title)) || R.find(r => r.src === "spend" && r.ref.sub === "Movie");
  const trip = R.filter(r => r.src === "spend" && r.ref.sub === "Travels" && /Place 2 to Place 1/.test(r.title)).sort((a, b) => b.amt - a.amt)[0];
  const swipe = D.card.filter(c => c.fraud === 0 && c.merchant && c.city).sort((a, b) => b.amt - a.amt)[3];
  const swipeD = D.card.indexOf(swipe);
  // mini heatmap (hour × weekday) and mini monthly sparkline
  const g = Array.from({ length: 7 }, () => Array(24).fill(0)); let gmax = 1;
  const months = new Map();
  for (const r of R) { if (r.src !== "music") continue; const dow = (dateOf(r.d).getUTCDay() + 6) % 7; gmax = Math.max(gmax, ++g[dow][r.h]); const k = monthKey(r.d); months.set(k, (months.get(k) || 0) + 1); }
  const cells = g.map((row, y) => row.map((v, x) => `<rect x="${x * 7}" y="${y * 7}" width="6" height="6" rx="1.5" fill="${["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"][Math.min(4, Math.floor(v / gmax * 5))]}"/>`).join("")).join("");
  const ks = [...months.keys()].sort((a, b) => a - b), mmax = Math.max(...months.values());
  const pts = ks.map((k, i) => `${(i / (ks.length - 1)) * 160},${44 - (months.get(k) / mmax) * 40}`).join(" ");
  $("#gallery").innerHTML = `
    <div class="pic vinyl" data-depth=".6" style="--x:55%;--y:6%"><div class="pic-in"><div class="disc"><div class="label">${esc(top[0])}<br>${num(top[1].n)} plays</div></div></div></div>
    <div class="pic polaroid" data-depth="1.1" style="--x:47%;--y:63%"><div class="pic-in"><svg viewBox="0 0 167 48" width="167" height="48">${cells}</svg><span>When the music plays · hour × weekday</span></div></div>
    <div class="pic ticket" data-depth=".9" style="--x:78%;--y:2%"><div class="pic-in"><small>ADMIT TWO · ${movie ? fmtD(movie.d).toUpperCase() : ""}</small><b>${esc(movie?.title || "Movie night")}</b><span>${movie ? inr(movie.amt) : ""} · Culture / Movie</span></div></div>
    <div class="pic pass" data-depth=".8" style="--x:70%;--y:78%"><div class="pic-in"><small>BOARDING PASS · ${trip ? fmtD(trip.d).toUpperCase() : ""}</small><b>Place 2 <i>→</i> Place 1</b><span>${esc(trip?.title.replace(/^2\s*/, "").replace(/Place 2 to Place 1\s*-?\s*/, "") || "Shree Sharma Travels")} · ${trip ? inr(trip.amt) : ""}</span></div></div>
    <div class="pic swipe" data-depth="1.3" style="--x:84%;--y:72%"><div class="pic-in"><small>CARD · ${swipe ? fmtD(swipe.d).toUpperCase() : ""} · ✓ VERIFIED</small><b>${esc(swipe?.merchant || "")}</b><span>${esc(swipe?.city || "")} · ${swipe ? inr(swipe.amt) : ""}</span></div></div>
    <div class="pic spark" data-depth=".5" style="--x:55%;--y:86%"><div class="pic-in"><svg viewBox="0 0 160 48" width="160" height="48"><polyline points="${pts}" fill="none" stroke="#2a78d6" stroke-width="1.5" stroke-linejoin="round"/></svg><span>plays per month · 2013 → 2024</span></div></div>`;
}

// ---------- journey ----------
const PINS = [
  ["2013-07-08", "First recorded play", "The record begins with web-player sessions on a Monday morning: The Mowgli's, Calvin Harris and Lana Del Rey. No expense or card data exists for this period."],
  ["2015-03-03", "Dental treatment", "Two months after the expense tracker starts, a series of dental bills begins: ₹3,000 on this day, followed by ₹1,900, ₹1,000 and ₹3,700 over the next three weeks. No music was played."],
  ["2016-01-13", "Wedding gift recorded", "₹45,000 is logged as income with the note 'wedding gift'. Music activity stops almost entirely for the following five months."],
  ["2016-07-18", "First Beatles play", "Listening resumes. The first Beatles play in the record occurs during an afternoon session otherwise dominated by James Bay; 13,620 further Beatles plays follow over the next eight years."],
  ["2016-11-08", "Demonetisation", "₹500 and ₹1,000 notes are withdrawn from circulation. The day's records show a Netflix renewal and My Chemical Romance plays. The first Gpay reward appears in the ledger 17 days later."],
  ["2017-09-07", "1,275 plays in one day", "1,275 plays within 2.8 hours, consistent with skipping through the full library. 'Little Wing' alone is played eleven times."],
  ["2018-01-18", "Two-wheeler purchase", "A ₹50,000 instalment on a two-wheeler. From this point the ledger contains regular ₹10 station parking and ₹20 mall parking entries."],
  ["2018-07-31", "Salary increase", "Salary of ₹70,255, up from ₹65,122 the previous month. ₹30,000 is transferred under the note 'Home' the same day."],
  ["2018-09-20", "Expense tracker ends", "The final entries are a ₹30 train ticket and two plates of idli medu vada. No expenses are logged after this date. Seven Paul McCartney tracks were played that morning."],
  ["2020-03-25", "National lockdown", "India enters lockdown. Monthly plays double within a month, and 2020 is the only year in which The Killers are played more than The Beatles."],
  ["2022-04-17", "Card statement begins", "A third data source begins after three and a half years of music-only records. Roughly half of its transactions are flagged by the bank as fraudulent."],
  ["2024-12-16", "Final recorded play", "Led Zeppelin, 'Black Country Woman', played at 4 am. This is the last record in the dataset."],
];
function journey() {
  const m0 = 2013 * 12 + 6, m1 = 2024 * 12 + 11, N = m1 - m0 + 1;
  const months = Array.from({ length: N }, () => ({ music: 0, spend: 0, card: 0, amt: 0 }));
  for (const r of R) { const m = months[monthKey(r.d) - m0]; m[r.src]++; if (r.src !== "music") m.amt += r.amt; }
  const W = 1100, L = 40, Rr = 12, top = 72, LH = 78, gap = 14, lanes = ["music", "spend", "card"];
  const H = top + lanes.length * (LH + gap) + 24;
  const x = i => L + (i / N) * (W - L - Rr), bw = (W - L - Rr) / N;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Monthly activity from July 2013 to December 2024 in three lanes: music plays, expense-tracker receipts and card swipes, with key events marked." });
  svg.innerHTML = `<defs><linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a78d6" stop-opacity=".8"/><stop offset="1" stop-color="#2a78d6" stop-opacity=".08"/></linearGradient></defs>`;
  // year grid
  const g = el("g", { class: "grid" });
  for (let y = 2014; y <= 2024; y++) { const i = y * 12 - m0; g.appendChild(el("line", { x1: x(i), x2: x(i), y1: top - 6, y2: H - 20 })); g.appendChild(el("text", { x: x(i) + 3, y: H - 6, text: y })); }
  svg.appendChild(g);
  lanes.forEach((lane, li) => {
    const y0 = top + li * (LH + gap), max = Math.max(...months.map(m => m[lane])) || 1;
    const y = v => y0 + LH - (v / max) * LH;
    svg.appendChild(el("text", { class: "lane-label", x: L, y: y0 - 3, text: `${lane} · ${lane === "music" ? "plays" : "receipts"} / month · peak ${num(max)}` }));
    svg.appendChild(el("line", { x1: L, x2: W - Rr, y1: y0 + LH, y2: y0 + LH, stroke: "var(--line)" }));
    if (lane === "music") {
      let p = `M${x(0)},${y0 + LH}`; months.forEach((m, i) => p += ` L${x(i) + bw / 2},${y(m[lane])}`); p += ` L${x(N - 1) + bw},${y0 + LH} Z`;
      svg.appendChild(el("path", { d: p, fill: "url(#gm)", stroke: COLOR[lane], "stroke-width": 1.5, "stroke-linejoin": "round" }));
    } else months.forEach((m, i) => { if (m[lane]) svg.appendChild(el("rect", { x: x(i) + 1, y: y(m[lane]), width: Math.max(bw - 2, 1), height: y0 + LH - y(m[lane]), fill: COLOR[lane], rx: 1 })); });
  });
  // pins
  PINS.forEach(([ds, label], i) => {
    const d = dayOf(ds), mi = monthKey(d) - m0, px = x(mi) + bw / 2, ty = 14 + (i % 4) * 13;
    const pg = el("g", { class: "pin" }, [
      el("line", { x1: px, x2: px, y1: ty + 3, y2: H - 20, stroke: "var(--ink-3)", "stroke-dasharray": "2 3" }),
      el("circle", { cx: px, cy: ty, r: 3.5, fill: "var(--gold)" }),
      el("text", { x: px + 6, y: ty + 3.5, text: label, "text-anchor": i > PINS.length - 3 ? "end" : "start", dx: i > PINS.length - 3 ? -12 : 0 }),
    ]);
    pressable(pg, () => openDay(d, label, i), `${label}, ${fmtD(d)} — open this event`);
    svg.appendChild(pg);
  });
  // hover hits per month
  months.forEach((m, i) => {
    const h = el("rect", { class: "hit", x: x(i), y: top - 6, width: bw, height: H - top - 14, "aria-hidden": "true" });
    const d0 = dayOf(`${Math.floor((m0 + i) / 12)}-${String((m0 + i) % 12 + 1).padStart(2, "0")}-01`);
    hover(h, () => `<b>${fmtM(d0)}</b><div class="row"><span>Music</span><b>${num(m.music)} plays</b></div><div class="row"><span>Spend</span><b>${num(m.spend)} entries</b></div><div class="row"><span>Card</span><b>${num(m.card)} swipes</b></div>${m.amt ? `<div class="row"><span>Money out</span><b>${inr(m.amt)}</b></div>` : ""}<div class="row"><span style="color:var(--ink-3)">click to explore</span></div>`);
    h.addEventListener("click", () => focusExplorer(d0, monthKey(d0) === m1 ? dayOf("2024-12-31") : dayOf(`${Math.floor((m0 + i + 1) / 12)}-${String((m0 + i + 1) % 12 + 1).padStart(2, "0")}-01`) - 1, fmtM(d0)));
    svg.appendChild(h);
  });
  $("#journey-chart").appendChild(svg);
}

// ---------- chapters ----------
const CHAPTERS = [
  { n: "00", title: "Early listening", from: "2013-07-08", to: "2014-12-31", c: "music",
    story: s => `Music is the only source for this period: <b>${num(s.plays)} plays</b> over eighteen months, all through a web player, followed by a long gap. ${s.top[0] ? `<b>${s.top[0][0]}</b> and ${s.top[1][0]} are already the most-played artists.` : ""} No mobile listening is recorded until mid-2015.`,
    threads: ["2013-07-08"] },
  { n: "01", title: "Expense tracking begins", from: "2015-01-01", to: "2015-12-31", c: "spend",
    story: s => `The expense tracker starts in January 2015. A monthly salary of approximately <b>${inr(49806)}</b> is recorded on the last day of each month. Notable entries include a <b>root canal</b> paid in four instalments in March and a <b>Kindle</b> in October. Cash accounts for <b>${pct(s.cash / s.exN)}</b> of expenses. Listening resumes in June on an Android device, led by <b>${s.top[0][0]}</b>, ${s.top[1][0]} and ${s.top[2][0]}.`,
    threads: ["2015-03-03", "2015-10-07", "2015-11-15"] },
  { n: "02", title: "Marriage and demonetisation", from: "2016-01-01", to: "2016-12-31", c: "spend",
    story: s => `On 13 January a <b>₹45,000 wedding gift</b> is logged as income, after which music activity drops to <b>five plays in five months</b>. Listening resumes in June, and the first Beatles play occurs on 18 July; The Beatles go on to be the most-played artist in eight of the following nine years. From August the ledger records regular "pocket money" transfers to family, a psychology entrance exam fee and a Nokia handset for <i>Aai</i>. Demonetisation takes effect on <b>8 November</b>; Gpay rewards appear in the ledger seventeen days later, and the cash share of spending does not return to its earlier level.`,
    threads: ["2016-01-13", "2016-07-18", "2016-11-08", "2016-12-29"] },
  { n: "03", title: "Peak listening year", from: "2017-01-01", to: "2017-12-31", c: "music",
    story: s => `The highest listening volume in the record: <b>${num(s.plays)} plays</b> and ${num(s.sec / 3600)} hours, of which <b>${num(s.top[0][1])}</b> are The Beatles. Expense entries are frequently recorded in pairs: "2 tickets", "2 Place 2 to Place 1", two purses at Rakshabandhan. Eight <b>farewell contributions</b> for departing colleagues are logged, and a cluster of print-outs, envelopes and courier charges in May is consistent with job applications. Two recurring deposits and a fixed deposit mature in July and are redirected into mutual funds; <b>${inr(s.invest)}</b> is transferred to savings and investments during the year. On 7 September, <b>1,275 plays are recorded in 2.8 hours</b>, consistent with skipping through the full library.`,
    threads: ["2017-01-03", "2017-03-12", "2017-07-27", "2017-09-07", "2017-09-24", "2017-10-26"] },
  { n: "04", title: "Job change and vehicle purchase", from: "2018-01-01", to: "2018-09-20", c: "spend",
    story: s => `The year opens with a <b>two-wheeler purchase</b>: a ₹1,000 booking on 3 January, followed by instalments of ₹50,000 and ₹43,000. From this point ₹10 station parking and ₹20 mall parking appear regularly in the ledger. A ₹100 book purchased in March is titled <i>Finding next Job</i>; in July the monthly salary rises to <b>₹70,255</b>. Provident fund and small-cap SIP contributions are made every month, with <b>${inr(s.invest)}</b> moved to savings over nine months. Other regular entries include PVR cinema tickets, Domino's on payday and a Ganesh idol on 16 September. The final expense entry is recorded on <b>20 September 2018</b>: a ₹30 train ticket and two plates of idli. The tracker is not used again.`,
    threads: ["2018-01-18", "2018-03-23", "2018-07-31", "2018-09-16", "2018-09-20"] },
  { n: "05", title: "Music only, 2018–2022", from: "2018-09-21", to: "2022-04-16", c: "music",
    story: s => `Music is the only source for this period: <b>${num(s.plays)} plays</b> over ${num(s.sec / 3600)} hours. 2020 has the second-highest annual volume in the record, with monthly plays doubling between March and April, and it is the only year in which <b>The Killers</b> are played more than The Beatles. Plays of Howard Shore's <i>Lord of the Rings</i> scores rise from 6 in 2018 to 354 in 2020. <b>${pct(s.night / s.plays)}</b> of plays fall between 11 pm and 5 am. Joaquín Sabina first appears in late 2021 and is the second most-played artist of 2022.`,
    threads: ["2020-03-25", "2020-08-16", "2020-10-09", "2022-03-05"] },
  { n: "06", title: "Card statement, 2022–2024", from: "2022-04-17", to: "2024-04-16", c: "card",
    story: s => `A card statement begins in April 2022: <b>${num(s.cardN)} transactions</b> totalling <b>${inr(s.cardAmt)}</b> across <b>${s.cities.size} cities</b> in two years. The bank flagged <b>${pct(s.fraud / s.cardN)}</b> of these as fraudulent; every merchant name in the source file carries the prefix <code>fraud_</code>, and a number of rows are missing dates, cities or amounts. Music activity over the same period is stable, led by The Beatles, The Killers and Sabina, with a 508-play day on 1 October 2022. Flagged and unflagged transactions can be separated in the explorer.`,
    threads: ["2022-10-01", "2023-06-15", "2023-12-25", "2024-03-14"] },
  { n: "07", title: "After the statement", from: "2024-04-17", to: "2024-12-16", c: "music",
    story: s => `The card statement ends in April 2024; music activity continues. ABBA appears in the record for the first time, and John Mayer, the first artist played in July 2013, returns to the top three. The final record in the dataset is <b>Led Zeppelin, "Black Country Woman"</b>, played at 4 am on 16 December 2024, eleven and a half years after the first web-player session.`,
    threads: ["2024-08-15", "2024-12-16"] },
];
function persona(s) {
  const t = [];
  if (s.plays > 100) {
    const nw = s.newPlays / s.plays, sk = s.skips / s.plays, plat = [...s.plats].sort((a, b) => b[1] - a[1])[0][0];
    t.push(`${nw > .5 ? "High" : nw > .1 ? "Moderate" : "Low"} discovery · ${pct(nw)} new-artist plays`);
    t.push(`Skip rate · ${pct(sk)}`);
    if (s.night / s.plays > .35) t.push("Late-night listener");
    t.push({ "web player": "Web player", android: "Android", "cast to device": "Cast to device", windows: "Windows", mac: "Mac" }[plat] || plat);
  }
  if (s.exN > 20) {
    t.push(s.cash / s.exN > .5 ? "Mainly cash" : "Mainly digital");
    if (s.income) t.push(`${pct(s.invest / s.income)} of income to savings`);
    t.push(`Largest category · ${s.topCats[0][0]}`);
  }
  if (s.cardN > 50) t.push(s.fraud / s.cardN > .3 ? "High fraud exposure" : "Low fraud exposure", `${s.cities.size} cities on statement`);
  return t;
}
function chapters() {
  const host = $("#chapters-list");
  for (const ch of CHAPTERS) {
    const d0 = dayOf(ch.from), d1 = dayOf(ch.to), s = stats(d0, d1);
    const tiles = []; // [value, label, search query?] — no query = open the chapter's date range
    if (s.plays) { tiles.push([num(s.plays), "plays"], [s.top[0][0], `top artist · ${num(s.top[0][1])} plays`, s.top[0][0]], [pct(s.night / s.plays), "played 11 pm – 5 am"]); if (s.newArtists.length) tiles.push([s.newArtists[0][0], "most-played new artist", s.newArtists[0][0]]); }
    if (s.spendN) tiles.push([inr(s.expense), `spent · ${num(s.exN)} expenses`], [s.topCats[0][0], `top category · ${inr(s.topCats[0][1])}`, s.topCats[0][0]], [pct(s.cash / s.exN), "paid in cash", "cash"], [inr(s.invest), "to savings & transfers"]);
    if (s.cardN) tiles.push([num(s.cardN), "card transactions"], [inr(s.cardAmt), "transaction value"], [pct(s.fraud / s.cardN), "flagged as fraud"], [s.cities.size, "cities"]);
    const shown = tiles.filter(([v]) => v !== "₹0");
    const art = document.createElement("article");
    art.className = "chapter"; art.style.setProperty("--c", COLOR[ch.c]); art.style.setProperty("--tint", `var(--tint-${ch.c})`);
    art.innerHTML = `<span class="ghost-num" aria-hidden="true">${ch.n}</span><div class="head"><span class="num">CHAPTER ${ch.n}</span><h3>${ch.title}</h3><span class="when">${fmtD(d0)} → ${fmtD(d1)}</span></div>
      <div class="row who"><span class="lab">Who you were</span><div class="items" data-lenis-prevent>${persona(s).map(x => { const [b, ...d] = x.split(" · "); return `<span class="trait"><b>${esc(b)}</b>${d.length ? `<small>${esc(d.join(" · "))}</small>` : ""}</span>`; }).join("")}</div></div>
      <div class="body"><p class="story">${ch.story(s)}</p><div class="keep">${keepsakes(s, d0, d1).map(k => k.html).join("")}</div></div>
      <div class="row stats"><span class="lab">By the numbers</span><div class="items" data-lenis-prevent>${shown.map(([v, l, q], i) => `<button type="button" class="stat" data-i="${i}" title="${q ? `Search “${esc(q)}”` : "Open these months in the explorer"}"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></button>`).join("")}</div></div>
      <div class="row threads"><h4 class="lab">Threads · same day</h4><div class="items" data-lenis-prevent>${threadsFor(ch, d0, d1).map(threadHTML).join("")}</div></div>
      <div class="actions"><button class="ghost" data-x>Open this chapter in the explorer →</button></div>`;
    art.querySelector("[data-x]").addEventListener("click", () => focusExplorer(d0, d1, ch.title));
    art.querySelectorAll(".stat").forEach(b => b.addEventListener("click", () => { const q = shown[+b.dataset.i][2]; q ? searchExplorer(q) : focusExplorer(d0, d1, ch.title); }));
    art.querySelectorAll(".thread").forEach(t => t.addEventListener("click", () => openDay(+t.dataset.d)));
    const ks = keepsakes(s, d0, d1); art.querySelectorAll(".keep .pic").forEach((p, i) => p.addEventListener("click", ks[i].go));
    host.appendChild(art);
  }
}
// pictures built from the chapter's own receipts: a record for the top artist, a stub for the
// biggest bill, a card for the most-used verified merchant, a strip of plays-per-month
const KEEP_POS = [["0%", "6%"], ["26%", "44%"], ["34%", "-2%"]];
function keepsakes(s, d0, d1) {
  const out = [], pos = () => { const [x, y] = KEEP_POS[out.length]; return `style="--x:${x};--y:${y}"`; };
  if (s.plays) out.push({ go: () => searchExplorer(s.top[0][0]), html: `<button type="button" class="pic vinyl" ${pos()} aria-label="Search ${esc(s.top[0][0])}"><div class="pic-in"><div class="disc"><div class="label">${esc(s.top[0][0])}<br>${num(s.top[0][1])} plays</div></div></div></button>` });
  const bill = R.filter(r => r.src === "spend" && r.kind === "Expense" && r.d >= d0 && r.d <= d1 && !/transfer|loan|\bemi\b|invest|provident|deposit|\bsip\b|mutual/i.test(r.title)).sort((a, b) => b.amt - a.amt)[0];
  if (bill) out.push({ go: () => openReceipt(bill), html: `<button type="button" class="pic ticket" ${pos()} aria-label="Open receipt: ${esc(bill.title)}"><div class="pic-in"><small>LARGEST EXPENSE · ${fmtD(bill.d).toUpperCase()}</small><b>${esc(bill.title)}</b><span>${inr(bill.amt)} · ${esc(bill.ref.cat)}</span></div></button>` });
  if (s.cardN) {
    const m = new Map(); for (const r of R) if (r.src === "card" && r.fraud === 0 && r.ref.merchant && r.d >= d0 && r.d <= d1) m.set(r.ref.merchant, (m.get(r.ref.merchant) || 0) + 1);
    const [mer, n] = [...m].sort((a, b) => b[1] - a[1])[0] || [];
    if (mer) out.push({ go: () => searchExplorer(mer), html: `<button type="button" class="pic swipe" ${pos()} aria-label="Search ${esc(mer)}"><div class="pic-in"><small>MOST FREQUENT MERCHANT · VERIFIED</small><b>${esc(mer)}</b><span>${n} transactions · ${s.cities.size} cities</span></div></button>` });
  }
  if (out.length < 2 && s.plays) { // music-only era: a strip of plays per month
    const m = new Map(); for (const r of R) { if (r.d < d0) continue; if (r.d > d1) break; if (r.src === "music") m.set(monthKey(r.d), (m.get(monthKey(r.d)) || 0) + 1); }
    const ks = [...m.keys()].sort((a, b) => a - b), mx = Math.max(...m.values());
    const pts = ks.map((k, i) => `${(i / Math.max(1, ks.length - 1)) * 160},${44 - (m.get(k) / mx) * 40}`).join(" ");
    out.push({ go: () => focusExplorer(d0, d1, "plays"), html: `<button type="button" class="pic spark" ${pos()} aria-label="Open these months in the explorer"><div class="pic-in"><svg viewBox="0 0 160 48" width="160" height="48" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#2a78d6" stroke-width="1.5" stroke-linejoin="round"/></svg><span>plays per month · ${fmtD(d0).slice(-4)} → ${fmtD(d1).slice(-4)}</span></div></button>` });
  }
  return out;
}
function threadsFor(ch, d0, d1) {
  const days = new Set(ch.threads.map(dayOf));
  // auto-fill: notable spend/card receipts with a soundtrack that day
  const notable = R.filter(r => r.d >= d0 && r.d <= d1 && r.src !== "music" && !days.has(r.d) && (r.src === "card" ? r.fraud === 0 && r.ref.merchant && r.ref.city : r.kind === "Expense" && (/Events|Entertainment|Health/.test(r.type) || r.amt > 1500)) && daySummary(r.d).music.length > 10);
  notable.sort((a, b) => b.amt - a.amt);
  for (const r of notable) { if (days.size >= 6) break; days.add(r.d); }
  return [...days].sort((a, b) => a - b);
}
function threadHTML(d) {
  const s = daySummary(d), bits = [], seen = new Set();
  const uniq = rs => rs.filter(r => !seen.has(r.title + r.amt) && seen.add(r.title + r.amt));
  const sp = s.spend.filter(r => r.kind !== "Expense" || r.amt >= 100 || /Events|Entertainment|Health|Places/.test(r.type)).sort((a, b) => b.amt - a.amt).slice(0, 3);
  for (const r of uniq(sp.length ? sp : s.spend.slice(0, 2))) bits.push(["spend", `${r.title} · ${inr(r.amt)}`]);
  for (const r of uniq(s.card.filter(r => r.fraud === 0).sort((a, b) => b.amt - a.amt)).slice(0, 2)) bits.push(["card", `${r.title}, ${r.ref.city || "?"} · ${inr(r.amt)}`]);
  const flagged = s.card.filter(r => r.fraud === 1).length;
  if (flagged) bits.push(["card", `⚠ ${flagged} flagged swipe${flagged > 1 ? "s" : ""}`]);
  if (s.music.length) bits.push(["music", `${s.artists.slice(0, 2).map(([a, n]) => `${a} ×${n}`).join(", ")} · ${num(s.music.length)} plays${s.hours ? `, ${s.hours[0]}:00–${s.hours[1]}:00` : ""}`]);
  else bits.push(["", "silence — no plays that day"]);
  const cap = PINS.find(p => dayOf(p[0]) === d)?.[1] || bits[0][1].split(" · ")[0];
  return `<button type="button" class="thread" data-d="${d}"><div class="d">${fmtD(d)}</div><div class="cap">${esc(cap)}</div><div class="r">${bits.map(([c, t]) => `<span class="bit ${c}">${esc(t)}</span>`).join("")}</div></button>`;
}

// ---------- charts (rhythms + places), re-rendered on resize so SVG text stays legible ----------
const CHART_HOSTS = ["#heat-music", "#heat-spend", "#cash-chart", "#eras-chart", "#night-chart", "#cat-chart", "#open-chart", "#rituals", "#anthems", "#place-net", "#state-chart"];
const widthOf = host => Math.max(300, host.clientWidth || 520);
function charts() {
  for (const h of CHART_HOSTS) $(h).innerHTML = "";
  rhythms(); places();
  for (const h of CHART_HOSTS) { const cap = $(h).closest("figure")?.querySelector("figcaption")?.textContent; $(h).querySelectorAll("svg").forEach(svg => { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", cap || "chart"); }); }
}

// ---------- rhythms ----------
function heatmap(host, grid, unit) {
  const max = Math.max(...grid.flat()) || 1, cw = 34, chh = 22, L = 34, T = 18, W = L + 24 * cw, H = T + 7 * chh;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  for (let h = 0; h < 24; h += 3) svg.appendChild(el("text", { x: L + h * cw + 2, y: 12, text: h + ":00" }));
  DOW.forEach((d, i) => svg.appendChild(el("text", { x: 0, y: T + i * chh + 15, text: d })));
  const steps = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];
  grid.forEach((row, di) => row.forEach((v, h) => {
    const c = el("rect", { x: L + h * cw + 1, y: T + di * chh + 1, width: cw - 2, height: chh - 2, rx: 3, fill: v ? steps[Math.min(4, Math.floor((v / max) * 5))] : "var(--surface-2)" });
    hover(c, `<b>${DOW[di]} ${h}:00–${h + 1}:00</b><br>${num(v)} ${unit}`);
    svg.appendChild(c);
  }));
  host.appendChild(svg);
}
function barsV(host, items, { color = "var(--music)", fmt = num, max: mx, label = k => k } = {}) {
  const max = mx || Math.max(...items.map(i => i[1])) || 1, W = widthOf(host), H = 150, L = 8, B = 20, n = items.length, bw = (W - L * 2) / n;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  items.forEach(([label_, v, extra], i) => {
    const h = (v / max) * (H - B - 18), x = L + i * bw;
    const r = el("rect", { x: x + 3, y: H - B - h, width: bw - 6, height: h, fill: color, rx: 3 });
    hover(r, `<b>${esc(label_)}</b><br>${fmt(v)}${extra ? "<br>" + extra : ""}`);
    svg.appendChild(r);
    svg.appendChild(el("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle", text: label(label_) }));
    if (i % Math.ceil(n / 6) === 0 || i === n - 1) svg.appendChild(el("text", { x: x + bw / 2, y: H - B - h - 4, "text-anchor": "middle", text: fmt(v) }));
  });
  host.appendChild(svg);
}
function rhythms() {
  const mg = Array.from({ length: 7 }, () => Array(24).fill(0)), sg = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of R) { if (r.h == null) continue; const dow = (dateOf(r.d).getUTCDay() + 6) % 7; const g = r.src === "music" ? mg : r.src === "spend" ? sg : null; if (g) g[dow][r.h]++; }
  heatmap($("#heat-music"), mg, "plays"); heatmap($("#heat-spend"), sg, "expenses");

  // cash share by quarter
  const q = new Map();
  for (const r of R) { if (r.src !== "spend" || r.kind !== "Expense") continue; const d = dateOf(r.d), k = `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`; const o = q.get(k) || [0, 0]; o[0]++; if (r.ref.mode === "Cash") o[1]++; q.set(k, o); }
  const qs = [...q].map(([k, [n, c]]) => [k, c / n, `${c} of ${n} expenses`]);
  barsV($("#cash-chart"), qs, { color: "var(--spend)", fmt: pct, max: 1, label: k => k.endsWith("Q1") ? k.slice(0, 4) : "" });
  const pre = qs.slice(0, 7).reduce((a, x) => a + x[1], 0) / 7, post = qs.slice(8, 14).reduce((a, x) => a + x[1], 0) / 6;
  $("#cash-note").textContent = `Demonetisation took effect on 8 November 2016 (Q4). The average cash share was ${pct(pre)} in the seven quarters before and ${pct(post)} in the six quarters after. Gpay rewards first appear in the ledger on 25 November 2016.`;

  // eras: top artist per half year
  const hy = new Map();
  for (const p of D.plays) { const d = dateOf(p[0]), k = `${d.getUTCFullYear()} H${d.getUTCMonth() < 6 ? 1 : 2}`; const m = hy.get(k) || new Map(); const a = D.tracks[p[2]][1]; m.set(a, (m.get(a) || 0) + 1); hy.set(k, m); }
  const eras = [...hy].filter(([, m]) => [...m.values()].reduce((a, b) => a + b, 0) > 50).map(([k, m]) => { const t = [...m].sort((a, b) => b[1] - a[1]); return [k, t[0][0], t[0][1], [...m.values()].reduce((a, b) => a + b, 0)]; });
  const palette = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"], order = [...new Set(eras.map(e => e[1]))];
  const W = widthOf($("#eras-chart")), H = 72, bw = W / eras.length, svgE = el("svg", { viewBox: `0 0 ${W} ${H}` });
  eras.forEach(([k, a, n, tot], i) => {
    const ci = order.indexOf(a), g = el("g");
    const r = el("rect", { x: i * bw + 1, y: 0, width: bw - 2, height: 48, rx: 4, fill: ci < palette.length ? palette[ci] : "var(--line-2)", "fill-opacity": .95 });
    hover(r, `<b>${k}</b><br>${esc(a)} · ${num(n)} of ${num(tot)} plays`);
    g.append(r, el("text", { x: i * bw + bw / 2, y: H - 8, "text-anchor": "middle", text: k.endsWith("H1") ? k.slice(0, 4) : "" }));
    svgE.appendChild(g);
  });
  const legend = document.createElement("div"); legend.className = "legend"; legend.style.marginTop = "8px";
  legend.innerHTML = order.map((a, i) => `<span><i class="sw" style="background:${i < palette.length ? palette[i] : "var(--line-2)"}"></i>${esc(a)}</span>`).join("");
  $("#eras-chart").append(svgE, legend);

  // night owl
  const ny = new Map();
  for (const p of D.plays) { const y = yearOf(p[0]); const o = ny.get(y) || [0, 0]; o[0]++; if (p[1] >= 23 || p[1] < 5) o[1]++; ny.set(y, o); }
  barsV($("#night-chart"), [...ny].filter(([, [n]]) => n > 100).map(([y, [n, k]]) => [y, k / n, `${num(k)} of ${num(n)} plays`]), { fmt: pct, max: 1 });

  // openness: new-artist share & skip rate by year
  const op = new Map();
  for (const r of R) { if (r.src !== "music") continue; const y = yearOf(r.d); const o = op.get(y) || [0, 0, 0]; o[0]++; if (yearOf(artistStats.get(r.artist).first) === y) o[1]++; if (r.skip) o[2]++; op.set(y, o); }
  const opY = [...op].filter(([, v]) => v[0] > 500);
  const opHost = $("#open-chart");
  opHost.insertAdjacentHTML("beforeend", `<p class="note" style="margin:0 0 4px">Plays by artists first heard that year</p>`);
  barsV(opHost, opY.map(([y, v]) => [y, v[1] / v[0], `${num(v[1])} of ${num(v[0])} plays`]), { fmt: pct, max: 1 });
  opHost.insertAdjacentHTML("beforeend", `<p class="note" style="margin:8px 0 4px">Share of tracks skipped</p>`);
  barsV(opHost, opY.map(([y, v]) => [y, v[2] / v[0], `${num(v[2])} of ${num(v[0])} plays`]), { fmt: pct, max: 1 });

  // rituals: payday window, savings timing, milk
  const payDays = new Set(); for (const r of R) if (r.src === "spend" && r.ref.cat === "Salary") { payDays.add(r.d); payDays.add(r.d + 1); payDays.add(r.d + 2); }
  const dayEx = new Map(); let trIn = 0, trAll = 0, milk = 0, milkY = new Map();
  for (const r of R) {
    if (r.src !== "spend") continue;
    if (r.kind === "Expense") { dayEx.set(r.d, (dayEx.get(r.d) || 0) + r.amt); if (r.ref.sub === "Milk") { milk++; milkY.set(yearOf(r.d), (milkY.get(yearOf(r.d)) || 0) + 1); } }
    else if (r.kind === "Transfer-Out") { trAll += r.amt; if (payDays.has(r.d)) trIn += r.amt; }
  }
  const inW = [...dayEx].filter(([d]) => payDays.has(d)), outW = [...dayEx].filter(([d]) => !payDays.has(d));
  const avg = a => a.reduce((x, [, v]) => x + v, 0) / a.length, lift = avg(inW) / avg(outW) - 1, topMilk = [...milkY].sort((a, b) => b[1] - a[1])[0];
  $("#rituals").innerHTML = [
    [pct(trIn / trAll), "of every rupee moved to savings goes within 3 days of salary landing"],
    [(lift >= 0 ? "+" : "") + pct(lift), "daily spending in the 3 days after payday, vs. any other day"],
    [num(payDays.size / 3), "paydays logged · always the last day of the month"],
    [num(milk), `half-litre milk receipts · ${topMilk[1]} of them in ${topMilk[0]}`],
  ].map(([v, l]) => `<div class="tile spend"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");

  // anthems: most-played track per year
  const an = new Map();
  for (const r of R) { if (r.src !== "music") continue; const y = yearOf(r.d); const m = an.get(y) || new Map(); m.set(r.track, (m.get(r.track) || 0) + 1); an.set(y, m); }
  $("#anthems").innerHTML = [...an].filter(([y]) => y >= 2015).map(([y, m]) => { const [t, n] = [...m].sort((a, b) => b[1] - a[1])[0]; return `<button type="button" class="rcpt music" data-q="${esc(D.tracks[t][0])}"><div class="bar" aria-hidden="true"></div><div class="d">${y}</div><div><div class="t">${esc(D.tracks[t][0])}</div><div class="s">${esc(D.tracks[t][1])}</div></div><div class="a">×${n} plays</div></button>`; }).join("");
  $("#anthems").onclick = (e => { const row = e.target.closest("[data-q]"); if (row) searchExplorer(row.dataset.q); });

  // category share by year (stacked 100%)
  const cy = new Map(), tot = new Map();
  for (const r of R) { if (r.src !== "spend" || r.kind !== "Expense") continue; const y = yearOf(r.d), c = r.ref.cat; const m = cy.get(y) || new Map(); m.set(c, (m.get(c) || 0) + r.amt); cy.set(y, m); tot.set(c, (tot.get(c) || 0) + r.amt); }
  const topC = [...tot].sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]), cols = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#9a958a"];
  const years = [...cy.keys()].sort(), Wc = widthOf($("#cat-chart")), Hc = 170, bwc = (Wc - 16) / years.length, svgC = el("svg", { viewBox: `0 0 ${Wc} ${Hc}` });
  years.forEach((y, i) => {
    const m = cy.get(y), T = [...m.values()].reduce((a, b) => a + b, 0); let acc = 0;
    const segs = [...topC.map(c => [c, m.get(c) || 0]), ["Everything else", [...m].filter(([c]) => !topC.includes(c)).reduce((a, [, v]) => a + v, 0)]];
    segs.forEach(([c, v], si) => { const h = (v / T) * (Hc - 30), r = el("rect", { x: 8 + i * bwc + 4, y: Hc - 22 - acc - h + 1, width: bwc - 8, height: Math.max(h - 2, 0), fill: cols[si], rx: 2 }); hover(r, `<b>${y} · ${esc(c)}</b><br>${inr(v)} · ${pct(v / T)}`); svgC.appendChild(r); acc += h; });
    svgC.appendChild(el("text", { x: 8 + i * bwc + bwc / 2, y: Hc - 6, "text-anchor": "middle", text: y }));
  });
  const lg = document.createElement("div"); lg.className = "legend"; lg.style.marginTop = "8px";
  lg.innerHTML = [...topC, "Everything else"].map((c, i) => `<span><i class="sw" style="background:${cols[i]}"></i>${esc(c)}</span>`).join("");
  $("#cat-chart").append(svgC, lg);
}

// ---------- places ----------
const PLACE_ALIAS = { "permanent residence": "Home (permanent)", "current residence": "Home (current)", "station": "Station", "mall": "Mall", "mum": "Mumbai", "pune": "Pune", "brc": "Vadodara", "dadar": "Dadar", "bandra": "Bandra", "vikhroli": "Vikhroli", "sion": "Sion", "santacruz": "Santacruz", "ws": "WS", "baroda": "Vadodara", "chalisgaon": "Chalisgaon" };
function normPlace(s) {
  s = s.trim().replace(/\s*(returns?|spl train)\s*$/i, "").replace(/^\d+\s+/, "").replace(/\s+station$/i, "").trim();
  const k = s.toLowerCase(); if (PLACE_ALIAS[k]) return PLACE_ALIAS[k];
  const m = k.match(/^place\s+([0-9a-z])$/); if (m) return "Place " + m[1].toUpperCase();
  return null;
}
function places() {
  const edges = new Map(), nodes = new Map();
  for (const s of D.spend) {
    if (!/Transport|Travel/i.test(s.cat + s.sub)) continue;
    const m = s.note.match(/^(?:\d+\s+)?(.+?)\s+to\s+(.+?)(?:\s*[-(:].*)?$/i); if (!m) continue;
    const a = normPlace(m[1]), b = normPlace(m[2]); if (!a || !b || a === b) continue;
    const k = [a, b].sort().join("|"); edges.set(k, (edges.get(k) || 0) + 1);
    for (const n of [a, b]) nodes.set(n, (nodes.get(n) || 0) + 1);
  }
  const N = [...nodes].filter(x => x[1] >= 3).sort((a, b) => b[1] - a[1]).map(x => x[0]), hub = N[0], others = N.slice(1);
  const W = 560, H = 420, cx = W / 2, cy = H / 2, rad = 160, pos = { [hub]: [cx, cy] };
  others.forEach((n, i) => { const a = (i / others.length) * Math.PI * 2 - Math.PI / 2; pos[n] = [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; });
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  for (const [k, v] of edges) { const [a, b] = k.split("|"); if (!pos[a] || !pos[b]) continue; const l = el("line", { x1: pos[a][0], y1: pos[a][1], x2: pos[b][0], y2: pos[b][1], stroke: "var(--spend)", "stroke-opacity": .7, "stroke-width": Math.min(1 + v * 0.7, 10), "stroke-linecap": "round" }); hover(l, `<b>${esc(a)} ↔ ${esc(b)}</b><br>${v} trips logged`); svg.appendChild(l); }
  for (const n of N) { const [x, y] = pos[n], g = el("g", { class: "pin" }, [el("circle", { cx: x, cy: y, r: n === hub ? 14 : 6 + Math.min(nodes.get(n), 8), fill: "#fff", stroke: "var(--spend)", "stroke-width": 2 }), el("text", { x: n === hub ? x : x + (x - cx) * 0.16, y: n === hub ? y + 28 : y + (y - cy) * 0.16 + 4, "text-anchor": n === hub ? "middle" : x < cx - 20 ? "end" : x > cx + 20 ? "start" : "middle", text: n })]); hover(g, `<b>${esc(n)}</b><br>${nodes.get(n)} trips · click to search`); pressable(g, () => searchExplorer(n), `${n}, ${nodes.get(n)} trips — search receipts`); svg.appendChild(g); }
  $("#place-net").appendChild(svg);
  $("#place-note").textContent = `${hub} is the most connected location: ${nodes.get(hub)} of the ${[...edges.values()].reduce((a, b) => a + b, 0)} logged trips start or end there. The named stops (Dadar, Bandra, Vikhroli, Sion, Santacruz) are Mumbai suburban railway stations, which places "${hub}" on the Mumbai local network. Long-distance routes to Pune and Vadodara appear as paired tickets from late 2016 onward.`;

  // states
  const st = new Map();
  for (const c of D.card) { if (!c.state) continue; const o = st.get(c.state) || [0, 0]; o[0]++; if (c.fraud === 1) o[1]++; st.set(c.state, o); }
  const top = [...st].sort((a, b) => b[1][0] - a[1][0]).slice(0, 12), max = top[0][1][0], Ws = widthOf($("#state-chart")), rh = 24, L = 130, Hs = top.length * rh + 30, svgS = el("svg", { viewBox: `0 0 ${Ws} ${Hs}` });
  top.forEach(([s, [n, f]], i) => {
    const y = i * rh + 4, w = (n / max) * (Ws - L - 95), wf = w * f / n;
    svgS.appendChild(el("text", { x: L - 8, y: y + 15, "text-anchor": "end", text: s }));
    const ok = el("rect", { x: L, y: y + 2, width: w - wf - 1, height: rh - 6, fill: "var(--card)", rx: 3 }), fr = el("rect", { x: L + w - wf + 1, y: y + 2, width: wf, height: rh - 6, fill: "var(--flag)", rx: 3 });
    hover(ok, `<b>${esc(s)}</b><br>${n - f} verified swipes`); hover(fr, `<b>${esc(s)}</b><br>⚠ ${f} flagged as fraud (${pct(f / n)})`);
    svgS.append(ok, fr, el("text", { x: L + w + 6, y: y + 15, text: `${n} · ⚠ ${f}` }));
  });
  const lg = document.createElement("div"); lg.className = "legend"; lg.style.marginTop = "8px";
  lg.innerHTML = `<span><i class="sw card"></i>Verified</span><span><i class="sw flag"></i>⚠ Flagged as fraud</span>`;
  $("#state-chart").append(svgS, lg);
}

// ---------- explorer ----------
const F = { srcs: new Set(["music", "spend", "card"]), q: "", type: "", y0: 2013, y1: 2024, verified: false, focus: null, shown: 0, list: [] };
function explorer() {
  const types = [...new Set(R.map(r => r.type))].sort();
  $("#type-sel").innerHTML += types.map(t => `<option>${t}</option>`).join("");
  $("#src-chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); F.srcs = new Set([...document.querySelectorAll(".chip.on")].map(c => c.dataset.src)); apply(); });
  let t; $("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { F.q = e.target.value.trim().toLowerCase(); apply(); }, 150); });
  $("#type-sel").addEventListener("change", e => { F.type = e.target.value; apply(); });
  for (const k of ["y0", "y1"]) $("#" + k).addEventListener("input", e => { F[k] = +e.target.value; if (F.y0 > F.y1) { F[k === "y0" ? "y1" : "y0"] = F[k]; $("#" + (k === "y0" ? "y1" : "y0")).value = F[k]; } F.focus = null; apply(); });
  $("#verified").addEventListener("change", e => { F.verified = e.target.checked; apply(); });
  $("#reset").addEventListener("click", () => { Object.assign(F, { srcs: new Set(["music", "spend", "card"]), q: "", type: "", y0: 2013, y1: 2024, verified: false, focus: null }); $("#q").value = ""; $("#type-sel").value = ""; $("#y0").value = 2013; $("#y1").value = 2024; $("#verified").checked = false; document.querySelectorAll(".chip").forEach(c => { c.classList.add("on"); c.setAttribute("aria-pressed", "true"); }); apply(); });
  $("#more").addEventListener("click", () => renderMore());
  $("#results").addEventListener("click", e => { const row = e.target.closest(".rcpt"); if (row) openReceipt(F.list[+row.dataset.i]); });
  $("#drawer-close").addEventListener("click", () => $("#drawer").close());
  $("#play").addEventListener("click", () => openPin(0));
  $("#drawer").addEventListener("keydown", e => { if (storyIdx == null) return; if (e.key === "ArrowRight") openPin(storyIdx + 1); if (e.key === "ArrowLeft") openPin(storyIdx - 1); });
  $("#drawer").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  apply();
}
function apply() {
  $("#y0-lab").textContent = F.y0; $("#y1-lab").textContent = F.y1;
  const d0 = F.focus ? F.focus.d0 : dayOf(`${F.y0}-01-01`), d1 = F.focus ? F.focus.d1 : dayOf(`${F.y1}-12-31`);
  const words = F.q.split(/\s+/).filter(Boolean);
  F.list = R.filter(r => r.d >= d0 && r.d <= d1 && F.srcs.has(r.src) && (!F.type || r.type === F.type) && (!F.verified || r.fraud !== 1) && words.every(w => r.q.includes(w))).reverse();
  const amt = F.list.reduce((a, r) => a + (r.src !== "music" && r.kind !== "Income" ? r.amt || 0 : 0), 0), plays = F.list.filter(r => r.src === "music").length;
  $("#count").innerHTML = `${num(F.list.length)} receipts${F.focus ? ` · <span style="color:var(--gold)">${esc(F.focus.label)}</span>` : ""}${plays ? ` · ${num(plays)} plays` : ""}${amt ? ` · ${inr(amt)} out` : ""}`;
  F.shown = 0; $("#results").innerHTML = ""; renderMore();
}
function renderMore() {
  const frag = document.createDocumentFragment(), end = Math.min(F.shown + 120, F.list.length);
  for (let i = F.shown; i < end; i++) { const r = F.list[i], b = document.createElement("button"); b.type = "button"; b.className = "rcpt " + r.src; b.dataset.i = i; b.innerHTML = rowHTML(r); frag.appendChild(b); }
  $("#results").appendChild(frag); F.shown = end; $("#more").hidden = end >= F.list.length;
}
const rowHTML = r => `<div class="bar" aria-hidden="true"></div><div class="d">${fmtD(r.d)}${r.h != null ? `<span class="tm"><br>${String(r.h).padStart(2, "0")}:00</span>` : ""}</div><div><div class="t">${esc(r.title)}</div><div class="s">${esc(r.sub)}</div></div><div class="a">${r.src === "music" ? `${r.sec < 60 ? r.sec + "s" : Math.round(r.sec / 60) + "m"}${r.skip ? " · skipped" : ""}` : (r.kind === "Income" ? "+" : "") + inr(r.amt)}${r.fraud === 1 ? '<span class="fl">⚠ flagged</span>' : ""}</div>`;
function focusExplorer(d0, d1, label) { F.focus = { d0, d1, label }; F.y0 = yearOf(d0); F.y1 = yearOf(d1); $("#y0").value = F.y0; $("#y1").value = F.y1; apply(); $("#drawer").close(); wipeTo("#explorer", "Explorer"); }
function searchExplorer(q) { F.q = q.toLowerCase(); $("#q").value = q; F.focus = null; apply(); $("#drawer").close(); wipeTo("#explorer", "Explorer"); }

// ---------- drawer ----------
function dayHTML(d, exclude) {
  const s = daySummary(d), parts = [];
  if (s.music.length) parts.push(`<h4>Music · ${num(s.music.length)} plays, ${(s.sec / 3600).toFixed(1)} h, ${s.hours[0]}:00–${s.hours[1]}:00</h4><p class="blurb">${s.artists.slice(0, 4).map(([a, n]) => `<b>${esc(a)}</b> ×${n}`).join(", ")}${s.artists.length > 4 ? ` and ${s.artists.length - 4} more artists` : ""}.</p><div class="results">${s.tracks.slice(0, 5).map(([t, n]) => `<div class="rcpt music"><div class="bar" aria-hidden="true"></div><div class="d">×${n}</div><div><div class="t">${esc(D.tracks[t][0])}</div><div class="s">${esc(D.tracks[t][1])}</div></div><div></div></div>`).join("")}</div>`);
  else parts.push(`<h4>Music</h4><p class="blurb">No music was played on this day.</p>`);
  if (s.spend.length) parts.push(`<h4>Expense tracker · ${s.spend.length} entries</h4><div class="results">${s.spend.filter(r => r !== exclude).map(r => `<button type="button" class="rcpt spend" data-id="${r.id}">${rowHTML(r)}</button>`).join("")}</div>`);
  if (s.card.length) parts.push(`<h4>Card · ${s.card.length} transactions${s.card.some(r => r.fraud === 1) ? ` · ⚠ ${s.card.filter(r => r.fraud === 1).length} flagged` : ""}</h4><div class="results">${s.card.filter(r => r !== exclude).map(r => `<button type="button" class="rcpt card" data-id="${r.id}">${rowHTML(r)}</button>`).join("")}</div>`);
  return parts.join("");
}
let storyIdx = null;
function openDay(d, label, i) {
  const body = $("#drawer-body"), pin = i != null ? PINS[i] : null; storyIdx = i ?? null;
  const nav = pin ? `<div class="story-nav"><button class="ghost" data-prev ${i === 0 ? "disabled" : ""}>← Previous</button><span class="meta">Event ${i + 1} of ${PINS.length}</span><button class="ghost" data-next ${i === PINS.length - 1 ? "disabled" : ""}>Next →</button></div>` : "";
  body.innerHTML = `<div class="meta">${pin ? "KEY EVENT · " : ""}${DOW[(dateOf(d).getUTCDay() + 6) % 7].toUpperCase()} · ONE DAY, ALL SOURCES</div><h3 id="drawer-title">${fmtD(d)}${label ? ` — ${esc(label)}` : ""}</h3>${pin ? `<p class="blurb story-cap">${esc(pin[2])}</p>` : ""}${nav}${dayHTML(d)}<h4>Go</h4><div class="links-row"><button class="ghost" data-focus>Open this day in the explorer</button></div>`;
  body.querySelector("[data-focus]").addEventListener("click", () => focusExplorer(d, d, fmtD(d)));
  body.querySelector("[data-prev]")?.addEventListener("click", () => openPin(i - 1));
  body.querySelector("[data-next]")?.addEventListener("click", () => openPin(i + 1));
  wireDrawer(); $("#drawer").showModal(); lockScroll(true); body.scrollTop = 0; body.focus({ preventScroll: true });
  history.replaceState(null, "", "#day=" + dateOf(d).toISOString().slice(0, 10));
}
function openPin(i) { if (i < 0 || i >= PINS.length) return; openDay(dayOf(PINS[i][0]), PINS[i][1], i); }
function openReceipt(r) {
  storyIdx = null;
  const body = $("#drawer-body"); let head, threads = "";
  if (r.src === "music") {
    const a = artistStats.get(r.artist), topY = Object.entries(a.years).sort((x, y) => y[1] - x[1])[0];
    const trackN = R.reduce((n, x) => n + (x.src === "music" && x.track === r.track), 0);
    head = `<div class="meta">MUSIC · ${esc(r.plat)} · ${fmtD(r.d)} ${String(r.h).padStart(2, "0")}:00</div><h3 id="drawer-title">${esc(r.title)}</h3><p class="blurb">${esc(r.artist)} · <i>${esc(r.sub.split(" · ").slice(1).join(" · "))}</i></p><div class="amt">${Math.round(r.sec / 60)} min${r.skip ? " · skipped" : ""}</div>`;
    threads = `<h4>Thread · this artist</h4><p class="blurb"><b>${esc(r.artist)}</b> — ${num(a.n)} plays in total, first played on <b>${fmtD(a.first)}</b>, most played in <b>${topY[0]}</b> (${num(topY[1])} plays). This track: ${num(trackN)} plays.</p><div class="links-row"><button class="ghost" data-q="${esc(r.artist)}">All ${esc(r.artist)} plays</button><button class="ghost" data-q="${esc(r.title)}">This track</button></div>`;
  } else if (r.src === "spend") {
    const same = R.filter(x => x.src === "spend" && x.ref.sub && x.ref.sub === r.ref.sub), tot = same.reduce((a, x) => a + x.amt, 0);
    const places = r.ref.places;
    head = `<div class="meta">EXPENSE TRACKER · ${esc(r.ref.mode)} · ${fmtD(r.d)}${r.h != null ? " " + String(r.h).padStart(2, "0") + ":00" : ""}</div><h3 id="drawer-title">${esc(r.title)}</h3><p class="blurb">${esc(r.ref.cat)}${r.ref.sub ? " · " + esc(r.ref.sub) : ""} · ${r.kind}</p><div class="amt" style="color:${r.kind === "Income" ? "var(--card)" : "inherit"}">${r.kind === "Income" ? "+" : ""}${inr(r.amt)}</div>`;
    threads = `<h4>Thread · same kind of receipt</h4><p class="blurb">${r.ref.sub ? `<b>${esc(r.ref.sub)}</b> appears ${same.length} times in the ledger, ${inr(tot)} in total.` : `Category <b>${esc(r.ref.cat)}</b>.`}${places.length ? ` Mentions ${places.map(p => `<b>${esc(p)}</b>`).join(", ")}.` : ""}</p><div class="links-row">${r.ref.sub ? `<button class="ghost" data-q="${esc(r.ref.sub)}">All "${esc(r.ref.sub)}"</button>` : ""}<button class="ghost" data-q="${esc(r.ref.cat)}">All ${esc(r.ref.cat)}</button>${places.map(p => `<button class="ghost" data-q="${esc(p)}">${esc(p)}</button>`).join("")}</div>`;
  } else {
    const c = r.ref, sameM = c.merchant ? D.card.filter(x => x.merchant === c.merchant) : [], sameC = c.city ? D.card.filter(x => x.city === c.city) : [];
    head = `<div class="meta">CARD STATEMENT · ${fmtD(r.d)} ${String(r.h).padStart(2, "0")}:00</div><h3 id="drawer-title">${esc(r.title)}</h3><p class="blurb">${esc(r.sub)}${c.job ? ` · cardholder's job on file: <i>${esc(c.job)}</i>` : ""}</p><div class="amt">${inr(r.amt)}${r.fraud === 1 ? ' <span class="flag" style="font-size:.9rem">⚠ flagged as fraud by the bank</span>' : r.fraud === 0 ? ' <span style="font-size:.9rem;color:var(--card)">✓ verified</span>' : ' <span style="font-size:.9rem;color:var(--ink-3)">? no verdict recorded</span>'}</div>`;
    threads = `<h4>Thread · this merchant & city</h4><p class="blurb">${c.merchant ? `<b>${esc(c.merchant)}</b>: ${sameM.length} transactions, ${sameM.filter(x => x.fraud === 1).length} flagged.` : "Merchant not recorded."} ${c.city ? `<b>${esc(c.city)}</b>: ${sameC.length} transactions, ${sameC.filter(x => x.fraud === 1).length} flagged.` : ""}</p><div class="links-row">${c.merchant ? `<button class="ghost" data-q="${esc(c.merchant)}">Merchant</button>` : ""}${c.city ? `<button class="ghost" data-q="${esc(c.city)}">City</button>` : ""}${c.state ? `<button class="ghost" data-q="${esc(c.state)}">State</button>` : ""}</div>`;
  }
  body.innerHTML = head + `<h4>Same day · ${fmtD(r.d)}</h4>` + dayHTML(r.d, r) + threads + `<h4>Go</h4><div class="links-row"><button class="ghost" data-day>Open the full day</button><button class="ghost" data-focus>Open this day in the explorer</button></div>`;
  body.querySelector("[data-day]").addEventListener("click", () => openDay(r.d));
  body.querySelector("[data-focus]").addEventListener("click", () => focusExplorer(r.d, r.d, fmtD(r.d)));
  wireDrawer(); $("#drawer").showModal(); lockScroll(true); body.scrollTop = 0; body.focus({ preventScroll: true });
}
function wireDrawer() {
  const body = $("#drawer-body");
  body.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => searchExplorer(b.dataset.q)));
  body.querySelectorAll(".rcpt[data-id]").forEach(row => row.addEventListener("click", () => openReceipt(R.find(x => x.id === row.dataset.id))));
}
