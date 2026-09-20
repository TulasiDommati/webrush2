"""Fuse the three exports into one compact data.json for the site.
Run: python3 build_data.py
"""
import csv, json, re
from datetime import datetime, timedelta

ROOT = "."
EPOCH = datetime(2013, 1, 1)
def day_idx(dt): return (dt - EPOCH).days

# ---------- Spotify (UTC -> IST) ----------
tracks, tidx, plats, pidx, plays = [], {}, [], {}, []
for r in csv.DictReader(open(f"{ROOT}/archive copy/spotify_history.csv", encoding="utf-8-sig")):
    key = r["spotify_track_uri"]
    if key not in tidx:
        tidx[key] = len(tracks); tracks.append([r["track_name"], r["artist_name"], r["album_name"]])
    p = r["platform"]
    if p not in pidx: pidx[p] = len(plats); plats.append(p)
    t = datetime.strptime(r["ts"], "%Y-%m-%d %H:%M:%S") + timedelta(hours=5, minutes=30)
    plays.append([day_idx(t), t.hour, tidx[key], round(int(r["ms_played"]) / 1000), pidx[p], 1 if r["skipped"] == "TRUE" else 0])
plays.sort()

# ---------- Household expense tracker ----------
spend = []
for r in csv.DictReader(open(f"{ROOT}/Daily Household Transactions copy.csv", encoding="utf-8-sig")):
    parts = r["Date"].split(" ")
    d = datetime.strptime(parts[0], "%d/%m/%Y")
    hour = int(parts[1][:2]) if len(parts) > 1 else None
    places = sorted(set(re.findall(r"Place [0-9A-Z]", r["Note"])))
    spend.append({"d": day_idx(d), "h": hour, "mode": r["Mode"], "cat": r["Category"], "sub": r["Subcategory"],
                  "note": r["Note"].strip(), "amt": float(r["Amount"]), "kind": r["Income/Expense"], "places": places})
spend.sort(key=lambda x: (x["d"], x["h"] or 0))

# ---------- Card statement (dirty; keep rows with a date + amount, drop bogus coordinates) ----------
card = []
for r in csv.DictReader(open(f"{ROOT}/archive (2) copy/Augmented_IndiaTransactMultiFacet2024.csv", encoding="utf-8-sig")):
    if not r["trans_date_trans_time"] or not r["amt"]: continue
    t = datetime.strptime(r["trans_date_trans_time"], "%m/%d/%Y %H:%M")
    card.append({"d": day_idx(t), "h": t.hour, "merchant": r["merchant"].replace("fraud_", "").strip() or None,
                 "cat": r["category"] or None, "amt": float(r["amt"]), "city": r["city"].strip() or None,
                 "state": r["state"].strip() or None, "fraud": {"1.0": 1, "0.0": 0}.get(r["is_fraud"]),
                 "job": r["job"].strip() or None})
card.sort(key=lambda x: (x["d"], x["h"]))

out = {"epoch": "2013-01-01", "platforms": plats, "tracks": tracks, "plays": plays, "spend": spend, "card": card}
json.dump(out, open(f"{ROOT}/site/public/data/data.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(f"tracks {len(tracks)} plays {len(plays)} spend {len(spend)} card {len(card)}")
