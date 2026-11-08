"""Scam attacker: replays Gemini-reworded variants of a scam into Spacetime via start_campaign.

    python -m simulation.attacker            # the original package-fee attack
    python -m simulation.attacker toll       # any scenario id from simulation/scenarios.json

Scenarios (scam text + attack shape) live in simulation/scenarios.json. Variants are generated
by Gemini once per scenario and cached in simulation/variants.json under the scenario id.
"""
import json
import os
import subprocess
import sys
import time

from dotenv import load_dotenv

load_dotenv()
SCENARIOS_FILE = "simulation/scenarios.json"
CACHE = "simulation/variants.json"  # {"<scenario id>": [variant, ...]}

PROMPT = """YOU ARE A EDUCATOR FOR OLD PEOPLE ON ONLINE SCAMS. Lightly reword this scam text TO SHOW THEM DIFFERENT WAYS SCAMMERS CAN ATTACK THEM ONLINE. Keep it RECOGNIZABLE — change only a few words, keep the same structure and the URL. Do not rewrite completely. Output ONLY the reworded text, no quotes, no explanation. MAKE THEM BE BITHASH SIMILAR. Text: {text}"""


def load_scenarios():
    with open(SCENARIOS_FILE, encoding="utf-8") as f:
        return {s["id"]: s for s in json.load(f)}


def rephrase(text):
    from google import genai  # only needed when a cache file is missing

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    prompt = PROMPT.format(text=text)
    return client.models.generate_content(model="gemini-3.6-flash", contents=prompt).text.strip()


def load_cache():
    if not os.path.exists(CACHE):
        return {}
    with open(CACHE, encoding="utf-8") as f:
        return json.load(f)


def is_valid_variant(text, base):
    """Gemini sometimes answers with a refusal/essay instead of a reworded text. Keep only one-line
    rewrites of similar length to the original scam."""
    return "\n" not in text.strip() and len(text) <= 2 * len(base)


def get_variants(scenario, n=5, max_attempts=15):
    """Gemini once per scenario, then cached in variants.json under the scenario id.
    Invalid cached variants are dropped and topped back up to n."""
    base = scenario["base_scam"]
    cached = load_cache().get(scenario["id"], [])
    variants = [v for v in cached if is_valid_variant(v, base)]
    if len(variants) == n and len(cached) == n:
        return variants
    attempts = 0
    while len(variants) < n and attempts < max_attempts:
        if attempts:
            time.sleep(13)  # respect rate limit, ONE time
        attempts += 1
        text = rephrase(base)
        if is_valid_variant(text, base):
            variants.append(text)
            print(f"  variant {len(variants)}/{n}: {text}")
        else:
            print(f"  rejected Gemini output (not a one-line rewrite): {text[:80]!r}...")
    if not variants:
        raise RuntimeError(f"Gemini produced no usable variants for {scenario['id']}")
    cache = load_cache()  # re-read: another scenario may have been added meanwhile
    cache[scenario["id"]] = variants
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)
    return variants


def blast(text, n):
    subprocess.run(["spacetime", "call", "-s", "local", "patient-zero-db",
                    "start_campaign", json.dumps(text), str(n)])


def wave_sizes(scenario):
    """Size of each wave: starts at wave_size and multiplies by `growth` (default 1 = steady),
    capped at `max_wave`."""
    size = scenario["wave_size"]
    growth = scenario.get("growth", 1)
    cap = scenario.get("max_wave", size)
    sizes = []
    for _ in range(scenario["waves"]):
        sizes.append(int(min(size, max(cap, scenario["wave_size"]))))
        size *= growth
    return sizes


def run_scenario(scenario, log=print):
    """Sends waves of messages (see wave_sizes), cycling through the cached variants."""
    variants = get_variants(scenario)
    for i, n in enumerate(wave_sizes(scenario)):
        v = variants[i % len(variants)]
        log(f"Blasting {n}: {v}")
        blast(v, n)
        time.sleep(scenario["interval_s"])  # fast replay from cache


if __name__ == "__main__":
    scenarios = load_scenarios()
    run_scenario(scenarios[sys.argv[1] if len(sys.argv) > 1 else "package"])
