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
