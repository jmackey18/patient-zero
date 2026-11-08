# Patient Zero — HackUTD 2026
Catch zero-day scam campaigns by how fast they spread, warn people before they open.

## Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your keys

## Run detection PoC
python detection/detection_poc.py

## Ownership
- simulation/ -> Person 1
- detection/  -> Person 2
- backend/    -> Person 3
- frontend/   -> Person 4

Lock shared/schema.py together first, then work in your own folder.
EOF

## React frontend (Person 4)

The minimal three-view frontend lives in `frontend/`. Run `cd frontend && npm ci && npm run dev`; use `npm run build` for TypeScript and production build checks. All data is clearly labeled local mock data, behind a replaceable adapter. See [frontend/README.md](frontend/README.md) for expected data contracts, privacy boundaries, and SpacetimeDB integration dependencies. No Nemotron integration is included yet.

## Run Spacetime locally (backend/)
The module is TypeScript (`backend/spacetime/spacetimedb/src/index.ts`); clients are plain JS (`backend/client/`).
On Windows the CLI lives at `%LOCALAPPDATA%\SpacetimeDB\spacetime.exe` (add that folder to PATH to type `spacetime`).

```
spacetime start                                   # local server on 127.0.0.1:3000 (leave running)
cd backend/spacetime
spacetime publish -s local patient-zero-db -y     # always pass -s local; spacetime.json defaults to maincloud
spacetime call -s local patient-zero-db add '"Vishnu"'
spacetime sql  -s local patient-zero-db "SELECT * FROM person"

cd ../client
npm install
npm run generate                                  # regenerate bindings after any module change
node test_client.js YourName                      # prints PASS when the live insert arrives
```

## Deploy (Vultr)
Code changes go through GitHub; the server only pulls and deploys. On the server:

```
bash scripts/deploy.sh                    # git pull + rebuild frontend into /var/www/app
bash scripts/deploy.sh --backend          # also republish the Spacetime module
bash scripts/deploy.sh --backend --seed   # also reseed the 5,000 residents
```

From your laptop, in one line:

```
ssh root@149.28.246.156 "bash /root/patient-zero/scripts/deploy.sh"
```

The frontend build needs `frontend/.env.production` (live mode, `wss://db.149-28-246-156.sslip.io`, `patient-zero-db`). Site: https://149-28-246-156.sslip.io

## Seed Avon residents (backend/ + simulation/)
Gemini generated the personas once (`simulation/data/personas.json`, committed). Seeding is plain Python, no LLM.

```
cd backend/spacetime
spacetime publish -s local patient-zero-db --delete-data=on-conflict -y   # adds resident + resident_profile tables
cd ../client && npm run generate                                         # refresh client bindings
cd ../..
pip install -r requirements.txt
python simulation/generate_personas.py      # ONLY to regenerate personas.json (needs GEMINI_API_KEY in .env)
python simulation/residents.py --count 5000 # -> simulation/data/residents.json (seed 42, deterministic)
python simulation/seed_spacetime.py         # clear + load in batches of 500; prints row counts
# Vultr: python simulation/seed_spacetime.py --host https://db.149-28-246-156.sslip.io
spacetime sql -s local patient-zero-db "SELECT COUNT(*) AS n FROM resident"
```




## SpacetimeDB Module (`backend/spacetime/spacetimedb/src/index.ts`)

### Tables
- **resident** (locked schema): `{id, persona, exposed, warned, opened}` — the core state the MAP reads
- **resident_profile**: `{resident_id, name, age, district, x, y, weak_spot, susceptibility, open_delay_s}` — map coords + sim detail
- **message**: `{id, sender_id, sender_known, recipient_id, text, timestamp, campaign_id}` — the scam blasts
- **notification**: `{id, recipient_id, kind, text}` — `kind` is "recovery" (exposed victims) or "alert" (protected)

### Reducers
- **seed_residents_batch(rows)** — seeds 5000 residents (called by `simulation/seed_spacetime.py`)
- **clear_residents()** — wipes residents for reseed
- **start_campaign(scam_text, num_targets)** — scammer blasts scam_text to N UNEXPOSED residents, marks them `exposed=true`
- **flag_campaign()** — called by Python on detection:
  - `exposed` residents → inserts "recovery" notification
  - everyone else → inserts "alert" notification + marks `warned=true`

## Python Detection Layer (`detection/`)

- **simhash.py** — `simhash(text)` → 64-bit privacy-preserving fingerprint; `hamming(a,b)` → bit distance
- **detector.py** — `detect(messages, now, total_residents)`:
  - clusters messages by fingerprint similarity (hamming ≤ 22)
  - flags when velocity ≥ threshold AND distinct recipients ≥ 3 AND sender unknown
  - returns `{flagged, infected[], protected_count, num_clusters, cluster_meta, ...}`
  - privacy guard: known-sender bursts (newsletters) never flag
- **investigator.py** — `investigate(cluster_meta, total_msgs, total_recipients)`:
  - sends CLUSTER METADATA ONLY (no text — respects E2E encryption) to Nemotron
  - Nemotron reasons whether separate fingerprint-clusters are ONE coordinated campaign (catches LLM-rephrased variants)
  - returns `{is_coordinated_attack, confidence, reasoning, num_variants, ...}`
- **spacetime_client.py** — HTTP bridge to Spacetime:
  - `query(sql)` → reads any table as list of dicts
  - `call_reducer(name, args)` → calls a reducer
  - BASE url: set via env (local vs Vultr, see below)
- **live_detect.py** — the main loop: polls message table → detect → flag_campaign → Nemotron report. Run this.

## Attacker Simulation (`simulation/attacker.py`)
- Uses Gemini (cached in `simulation/variants.json`) to generate lightly-reworded scam variants
- Different wordings → different fingerprints → multiple clusters → Nemotron unifies them
- Replays cached variants fast (no live Gemini rate-limit risk)

## HOW TO RUN (local)

Terminal 1 — Spacetime DB (leave running):
```bash
spacetime start
```
Terminal 2 — publish + seed:
```bash
cd backend/spacetime/spacetimedb && spacetime publish -s local patient-zero-db && cd ~/patient-zero
python3 simulation/seed_spacetime.py
```
Terminal 3 — detection poller (leave running):
```bash
python3 -m detection.live_detect
```
Terminal 2 — launch attack:
```bash
python3 -m simulation.attacker
```
Watch Terminal 3: detect → protect → Nemotron incident report.

## HOW TO RUN ON VULTR

The shared instance is at `https://db.149-28-246-156.sslip.io` (db name: `patient-zero-db`).
Team rule: only `scripts/deploy.sh` on the server changes the shared Vultr DB.

1. Merge this branch to main.
2. Deploy module to Vultr (run `scripts/deploy.sh` or):
   ```bash
   spacetime server add vultr --url https://db.149-28-246-156.sslip.io
   spacetime publish -s vultr patient-zero-db
   ```
3. Point Python at Vultr — set env before running `live_detect.py`:
   ```bash
   export SPACETIME_URL=https://db.149-28-246-156.sslip.io
   python3 -m detection.live_detect
   ```
   (spacetime_client.py reads SPACETIME_URL, defaults to localhost)

## WIRING INTO THE FRONTEND — THE GRAND MAP

The frontend already subscribes to Spacetime tables and auto-syncs. To drive the map:

### Map dot colors — read the `resident` table, color by state:
- `exposed == true` → **RED** (hit by scam — the ~6 victims)
- `warned == true` → **GREEN** (protected — the ~4994 saved)
- neither → **GREY/NEUTRAL** (untouched)
- Position each dot by `resident_profile.x, y` (0..1 normalized map coords)

### The animation sequence (what judges see):
1. Attack starts → a few dots flash RED (exposed residents, in one district)
2. Detection fires → `flag_campaign` runs → GREEN WAVE sweeps across all other dots
3. Result: small red outbreak, massive green shield = "caught early, city protected"

### Notifications panel — read the `notification` table:
- `kind == "recovery"` → show recovery checklist for exposed victims
- `kind == "alert"` → show preemptive warning for protected residents
- Display `notification.text` as the message content

### Incident report / ops console — Nemotron output (`incident` table):
`live_detect.py` calls the `report_incident` reducer twice per campaign: `status = "investigating"`
when Nemotron starts, then `"complete"` (or `"failed"`) with the verdict. One row per campaign:

| column | meaning |
|---|---|
| `campaign_id` | campaign that was detected (PK) |
| `status` | `investigating` / `complete` / `failed` |
| `is_coordinated`, `confidence` | Nemotron verdict, confidence 0-100 |
| `reasoning`, `warning_text` | Nemotron's explanation and suggested carrier warning |
| `num_variants` | fingerprint clusters Nemotron linked into one campaign |
| `cluster_meta` | JSON array of cluster metadata (size, recipients, time spread; never message text) |
| `created_at`, `updated_at` | timestamps |

Reset between runs: `spacetime call -s local patient-zero-db clear_incidents`.

### Frontend: notifications + Nemotron feed (live mode)
The live adapter subscribes to `notification` and `incident` (never `message`, which holds scam text)
and exposes them on the snapshot as `data.liveFeed`. In a component:

```tsx
import { useLiveFeed } from "../data/useLiveFeed";

const feed = useLiveFeed(data);          // data = the snapshot App already passes down
feed.latestIncident?.status              // "investigating" | "complete" | "failed"
feed.latestIncident?.confidence          // 0-100
feed.latestIncident?.reasoning           // Nemotron's explanation
feed.latestIncident?.clusterMeta         // [{ size, distinct_recipients, time_spread_s, ... }]
feed.alertCount, feed.recoveryCount      // rows written by flag_campaign
feed.notificationsFor(residentId)        // one resident's alert / recovery messages
```

Types live in `frontend/src/data/contracts.ts` (`LiveFeed`, `LiveIncident`, `LiveNotification`).
In mock mode the feed is empty (`feed.available === false`), so components can render unconditionally.

### Live metrics (read from resident table counts):
- Exposed count = `SELECT COUNT(*) FROM resident WHERE exposed = true`
- Protected count = `SELECT COUNT(*) FROM resident WHERE warned = true`
- "Detected after N messages" / "X protected" — the headline numbers

### Key point for frontend dev:
Spacetime auto-pushes table changes to subscribed clients. So when Python calls
`flag_campaign`, the `resident.warned` fields update → the map's green wave happens
AUTOMATICALLY if the map is subscribed to the resident table. No manual websocket wiring.
