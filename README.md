# Receipts — one life, three exports

Frontend-only entry for "Your Life, In Receipts". Three unrelated exports
(a Spotify history, a household expense tracker, a card statement) are fused
into one person's eleven-year story: chapters, rhythms, places, and a
receipt explorer that pulls the "thread" of any moment across all sources.

## Run

```
npm install
npm run dev        # http://localhost:8000
npm run build      # static output in dist/
```

Frontend only — no backend, no API, no server code. Vite is used purely as the
dev server and bundler; `dist/` is plain HTML/CSS/JS plus one JSON file and can
be dropped on any static host (Netlify and Vercel auto-detect Vite; `netlify.toml`
is included). The app itself is vanilla JS; the only runtime dependencies are `gsap` and
`lenis` for motion. 161k receipts are parsed and aggregated in the browser.

## Rebuild the data

`site/public/data/data.json` is generated from the three raw files in this folder:

```
npm run data      # = python3 build_data.py
```

It shifts Spotify timestamps UTC→IST, drops card rows with no date/amount,
strips the `fraud_` merchant prefix (kept as the `fraud` flag), and discards
the card file's coordinate columns (they span the whole globe — synthetic
noise). Everything else is computed in the browser.

## What's where

- `site/index.html` — page structure and copy
- `site/style.css` — palette: deep green / off-white / peach / acid yellow, plus the three data-source hues (blue, orange, aqua) inside charts
- `site/motion.js` — Lenis smooth scroll + GSAP: preloader driven by the real download, theme morph between sections, yellow wipe transition on nav clicks, masked headline reveals, scroll-scrubbed paragraph fills, list staggers, chart draw-in, count-ups, magnetic buttons, custom cursor; all skipped under `prefers-reduced-motion`
- `site/app.js` — unify → journey chart → chapters (live stats + same-day threads + keepsake pictures) → rhythms → places → explorer + drawer → section pictures (24-hour clock, postcard, search slips)
- Every picture is drawn from the data (no image files) and is clickable: records search the artist, stubs open the receipt, postcard cities and slips run a search; chapter stats are buttons too
- **Play the story** (hero button) steps through 12 pinned moments with captions; ← → keys work
- Deep links: `#day=2017-03-12` opens a day, `#moment=5` opens a story step
