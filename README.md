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
