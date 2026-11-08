"""Expand simulation/data/personas.json into N Avon residents (no LLM, deterministic).

    python simulation/residents.py              # 5000 residents, seed 42
    python simulation/residents.py --count 1000

Writes simulation/data/residents.json: one flat row per resident = the locked Resident
fields {id, persona, exposed, warned, opened} + resident_profile fields. This is exactly
the SeedRow shape the Spacetime reducer seed_residents_batch takes.
"""
import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from shared.schema import new_resident  # noqa: E402

DATA = ROOT / "simulation" / "data"
PREFERRED_DISTRICT_CHANCE = 0.8  # otherwise the person lives anywhere in Avon
SCATTER = 0.05                   # std-dev of map position around the district center


def clamp01(v):
    return max(0.0, min(1.0, v))

# This function generates a list of residents based on the provided personas, count, and seed.
def make_residents(personas, count, seed):
    rng = random.Random(seed)
    archetypes = personas["archetypes"]
    weights = [a["weight"] for a in archetypes]
    districts = {d["name"]: d for d in personas["districts"]}
    first, last = personas["first_names"], personas["last_names"]

    rows = []
    for rid in range(1, count + 1):
        a = rng.choices(archetypes, weights=weights, k=1)[0]
        if rng.random() < PREFERRED_DISTRICT_CHANCE:
            district = districts[rng.choice(a["preferred_districts"])]
        else:
            district = rng.choice(list(districts.values()))
        row = new_resident(rid, a["persona"])
        row.update({
            "name": f"{rng.choice(first)} {rng.choice(last)}",
            "age": rng.randint(a["age_min"], a["age_max"]),
            "district": district["name"],
            "x": round(clamp01(rng.gauss(district["center_x"], SCATTER)), 4),
            "y": round(clamp01(rng.gauss(district["center_y"], SCATTER)), 4),
            "weak_spot": a["weak_spot"],
            "susceptibility": round(rng.uniform(a["susceptibility_min"], a["susceptibility_max"]), 3),
            "open_delay_s": rng.randint(a["open_delay_min_s"], a["open_delay_max_s"]),
        })
        rows.append(row)
    return rows

# This function prints a summary of the generated residents, including counts per persona, district, and weak spot.
def print_summary(rows):
    print(f"{len(rows)} residents")
    for field in ("persona", "district", "weak_spot"):
        print(f"\nper {field}:")
        for k, n in Counter(r[field] for r in rows).most_common():
            print(f"  {k:<32} {n:>5}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--count", type=int, default=5000)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--in", dest="inp", default=str(DATA / "personas.json"))
    p.add_argument("--out", default=str(DATA / "residents.json"))
    args = p.parse_args()

    personas = json.loads(Path(args.inp).read_text(encoding="utf-8"))
    rows = make_residents(personas, args.count, args.seed)
    Path(args.out).write_text(json.dumps(rows, ensure_ascii=False) + "\n", encoding="utf-8")
    print_summary(rows)
    print(f"\nwrote {Path(args.out).resolve().relative_to(ROOT)}")


if __name__ == "__main__":
    main()
