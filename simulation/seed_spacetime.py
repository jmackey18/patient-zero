"""Load simulation/data/residents.json into Spacetime over its HTTP API (no LLM, stdlib only).

    python simulation/seed_spacetime.py                                          # local
    python simulation/seed_spacetime.py --host https://db.149-28-246-156.sslip.io  # Vultr

Calls clear_residents, then seed_residents_batch in batches, then counts rows.
HTTP reducer call: POST {host}/v1/database/{db}/call/{reducer}, body = JSON array of args.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# This function sends a POST request to the specified URL with the given body and content type.
def post(url, body, content_type="application/json"):
    data = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": content_type})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} from {url}\n{e.read().decode('utf-8', 'replace')}")
    except urllib.error.URLError as e:
        sys.exit(f"Can't reach {url}: {e.reason} (is the Spacetime server running?)")

# This function counts the number of rows in the specified table by sending a SQL query to the Spacetime API.
def count(base, table):
    out = json.loads(post(f"{base}/sql", f"SELECT COUNT(*) AS n FROM {table}".encode(), "text/plain"))
    return out[0]["rows"][0][0]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", default="http://127.0.0.1:3000")
    p.add_argument("--db", default="patient-zero-db")
    p.add_argument("--batch", type=int, default=500)
    p.add_argument("--file", default=str(ROOT / "simulation" / "data" / "residents.json"))
    args = p.parse_args()

    rows = json.loads(Path(args.file).read_text(encoding="utf-8"))
    base = f"{args.host.rstrip('/')}/v1/database/{args.db}"
    print(f"seeding {len(rows)} residents into {args.db} at {args.host}")

    post(f"{base}/call/clear_residents", [])
    print("cleared existing residents")

    for i in range(0, len(rows), args.batch):
        chunk = rows[i:i + args.batch]
        post(f"{base}/call/seed_residents_batch", [chunk])
        print(f"  batch {i // args.batch + 1}: residents {chunk[0]['id']}-{chunk[-1]['id']}")

    n_res, n_prof = count(base, "resident"), count(base, "resident_profile")
    print(f"resident rows: {n_res}, resident_profile rows: {n_prof}")
    if n_res != len(rows) or n_prof != len(rows):
        sys.exit(f"MISMATCH: expected {len(rows)}")
    print("OK")


if __name__ == "__main__":
    main()
