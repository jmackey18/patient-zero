"""Generate Avon persona archetypes, districts and name pools with Gemini. Run ONCE.

Output: simulation/data/personas.json (committed, so nobody needs to call Gemini again).
The demo never calls an LLM: residents.py expands this file deterministically.

    python simulation/generate_personas.py
Needs GEMINI_API_KEY in .env (optional GEMINI_MODEL, default gemini-3.6-flash).
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field, ValidationError

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "simulation" / "data" / "personas.json"

PERSONAS = ["grandparent", "student", "small-biz"]
WEAK_SPOTS = [
    "unpaid toll",
    "package delivery",
    "bank fraud alert",
    "family emergency/impersonation",
    "job offer",
    "prize/giveaway",
    "account verification",
]
Persona = Literal["grandparent", "student", "small-biz"]
WeakSpot = Literal[
    "unpaid toll",
    "package delivery",
    "bank fraud alert",
    "family emergency/impersonation",
    "job offer",
    "prize/giveaway",
    "account verification",
]


class District(BaseModel):
    name: str = Field(description="Neon cyberpunk district name for the city of Avon, 1-3 words")
    description: str = Field(description="One short sentence on who lives there")
    center_x: float = Field(description="Map center x, between 0.1 and 0.9")
    center_y: float = Field(description="Map center y, between 0.1 and 0.9")


class Districts(BaseModel):
    districts: list[District]


class Archetype(BaseModel):
    persona: Persona
    label: str = Field(description="Short description, e.g. 'retired teacher, lives alone'")
    age_min: int
    age_max: int
    weak_spot: WeakSpot = Field(description="Scam type this person is most likely to fall for")
    susceptibility_min: float = Field(description="0-1, chance they fall for their weak spot")
    susceptibility_max: float
    open_delay_min_s: int = Field(description="Fastest they typically open a text, in seconds")
    open_delay_max_s: int = Field(description="Slowest they typically open a text, in seconds")
    preferred_districts: list[str] = Field(description="District names where this archetype usually lives")
    weight: float = Field(description="How common this archetype is in Avon, 1-10")


class Archetypes(BaseModel):
    archetypes: list[Archetype]


class NamePools(BaseModel):
    first_names: list[str]
    last_names: list[str]


def ask(client, model, prompt, schema_cls):
    """One structured-output call; returns a validated pydantic object (one retry)."""
    last_err = None
    for _ in range(2):
        for wait in (5, 15, 30, 60, None):  # back off on 503 "high demand" / 429
            try:
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_json_schema=schema_cls.model_json_schema(),
                        temperature=0.9,
                    ),
                )
                break
            except (errors.ServerError, errors.ClientError) as e:
                if wait is None or getattr(e, "code", None) not in (429, 500, 503):
                    raise
                print(f"  Gemini {e.code}, retrying in {wait}s...", file=sys.stderr)
                time.sleep(wait)
        try:
            return schema_cls.model_validate_json(resp.text)
        except ValidationError as e:
            last_err = e
            print("  invalid response, retrying...", file=sys.stderr)
    sys.exit(f"Gemini returned invalid JSON twice: {last_err}")


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def clean_districts(ds):
    seen, out = set(), []
    for d in ds:
        if d.name in seen:
            continue
        seen.add(d.name)
        out.append({
            "name": d.name.strip(),
            "description": d.description.strip(),
            "center_x": round(clamp(d.center_x, 0.1, 0.9), 3),
            "center_y": round(clamp(d.center_y, 0.1, 0.9), 3),
        })
    if len(out) < 6:
        sys.exit(f"Need 6 districts, got {len(out)}")
    return out[:6]


def clean_archetypes(arcs, district_names):
    out = []
    for a in arcs:
        age_lo, age_hi = sorted((clamp(a.age_min, 13, 99), clamp(a.age_max, 13, 99)))
        s_lo, s_hi = sorted((clamp(a.susceptibility_min, 0.0, 1.0), clamp(a.susceptibility_max, 0.0, 1.0)))
        d_lo, d_hi = sorted((clamp(a.open_delay_min_s, 1, 65535), clamp(a.open_delay_max_s, 1, 65535)))
        preferred = [d for d in a.preferred_districts if d in district_names] or list(district_names)
        out.append({
            "persona": a.persona,
            "label": a.label.strip(),
            "age_min": age_lo,
            "age_max": age_hi,
            "weak_spot": a.weak_spot,
            "susceptibility_min": round(s_lo, 3),
            "susceptibility_max": round(s_hi, 3),
            "open_delay_min_s": d_lo,
            "open_delay_max_s": d_hi,
            "preferred_districts": preferred,
            "weight": round(clamp(a.weight, 0.1, 10.0), 2),
        })
    if len(out) < 30:
        sys.exit(f"Need at least 30 archetypes, got {len(out)}")
    missing_p = set(PERSONAS) - {a["persona"] for a in out}
    missing_w = set(WEAK_SPOTS) - {a["weak_spot"] for a in out}
    if missing_p or missing_w:
        sys.exit(f"Archetypes missing personas {missing_p} / weak spots {missing_w}")
    return out


def clean_names(names):
    seen, out = set(), []
    for n in names:
        n = n.strip()
        if n and n.lower() not in seen:
            seen.add(n.lower())
            out.append(n)
    return out


def main():
    load_dotenv(ROOT / ".env")
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY missing from .env")
    model = os.getenv("GEMINI_MODEL") or "gemini-3.6-flash"
    client = genai.Client(api_key=key)
    print(f"model: {model}")

    print("1/3 districts...")
    ds = ask(client, model, (
        "HackUTD 2026's theme is 'Zero Day', set in Avon, a neon city that needs defending from scams. "
        "Invent exactly 6 Avon districts with neon/cyberpunk names. Mix residential, campus, old town, "
        "and commercial areas so grandparents, students and small-business owners each have places to live. "
        "Spread their centers across a 0-1 map (keep them at least 0.2 apart)."
    ), Districts)
    districts = clean_districts(ds.districts)
    names = [d["name"] for d in districts]
    print("   " + ", ".join(names))

    print("2/3 archetypes...")
    arcs = ask(client, model, (
        f"Avon districts: {json.dumps(districts)}\n"
        "Create 40 resident archetypes for a scam-spread simulation. Each persona is exactly one of "
        f"{PERSONAS}; spread them roughly 1/3 each. weak_spot must be one of {WEAK_SPOTS}; use every weak spot "
        "at least 3 times, matching the person (e.g. grandparents: family emergency, bank fraud; students: "
        "job offer, prize; small-biz: account verification, package delivery, unpaid toll). Ages: students "
        "16-28, small-biz 25-65, grandparents 60-92. susceptibility between 0.05 and 0.9 (range width ~0.1-0.25). "
        "open_delay in seconds: fast checkers 5-60, slow ones up to 3600. preferred_districts uses the exact "
        "district names above. weight 1-10 for how common the archetype is. Labels are short and specific, "
        "e.g. 'retired teacher, lives alone', 'night-shift nursing student', 'food-truck owner'."
    ), Archetypes)
    archetypes = clean_archetypes(arcs.archetypes, set(names))
    print(f"   {len(archetypes)} archetypes")

    print("3/3 name pools...")
    pools = ask(client, model, (
        "Give 150 distinct first names and 150 distinct last names for residents of Avon, a diverse "
        "American city (mix of Hispanic, Black, white, South Asian, East Asian, Middle Eastern, and other "
        "backgrounds, and of generations). Plain names only, no titles."
    ), NamePools)
    first, last = clean_names(pools.first_names), clean_names(pools.last_names)
    if len(first) < 100 or len(last) < 100:
        sys.exit(f"Name pools too small: {len(first)} first, {len(last)} last")
    print(f"   {len(first)} first, {len(last)} last")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "model": model,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "districts": districts,
        "archetypes": archetypes,
        "first_names": first,
        "last_names": last,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
