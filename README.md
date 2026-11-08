# 🦠 Patient Zero

### Catch the scam on its 6th message, not its 6,000th, without reading a single text.

**HackUTD 2026 · Zero Day · T-Mobile track** · Live demo: **https://patientzero.fishing**

---

## 30-second version

Scam texts don't hit one person. They hit **thousands of strangers within minutes**, and every new campaign has wording no classifier has seen before. That makes each one a *zero-day*.

More and more texting is moving to **end-to-end encrypted** apps (iMessage, RCS, WhatsApp), where the carrier can't read the messages, so it can't filter them.

**Patient Zero doesn't read the message. It watches how the message spreads.**

1. 📱 **Each phone sends only a fingerprint** (a 64-bit SimHash), never the text.
2. 🚨 **A sentinel spots the burst:** near-identical fingerprints hitting many unrelated people within seconds, from an unknown sender.
3. 🧠 **NVIDIA Nemotron reasons over metadata only.** It decides whether differently-worded clusters are one coordinated campaign: an AI attacker rewording the scam to slip past detection.
4. 🛡️ **Everyone gets warned:** a preemptive Scam Shield alert for the thousands who haven't been hit yet, and a recovery checklist for the few who were.

All of it runs live on **SpacetimeDB**. You press one button and watch a city of 5,000 residents go from outbreak to shielded.

---

## What the judges see

Press **Simulate** in the Command Center and the whole pipeline runs for real:

```
 Attacker (Gemini variants) ──► SpacetimeDB ──► Detector (SimHash + velocity) ──► Nemotron (metadata only)
                                     ▲                                                     │
                                     └──── flag_campaign: alerts + recovery notifications ─┘
                                                            │
                                         Live map · terminal · two phones light up
```

- 🗺️ **3D campus map:** 5,000 simulated residents. Red trails show who got hit, then the green shield spreads to everyone else.
- 💻 **Live terminal:** the attacker and detector logs stream straight from the backend into the browser.
- 🧠 **Nemotron card:** verdict, confidence, how many reworded variants it linked, the time from first to last exposed message, and its reasoning.
- 📲 **Two phones:** one lock screen wakes with the *preemptive alert*, the other with the *recovery guidance*, at the moment of detection.
- 🔁 **Reset city:** reseeds a fresh 5,000 residents for the next judge.

### Three attack styles, three different outcomes

Each scenario is a different attack shape. Nothing in the UI is hardcoded; every number below comes out of the pipeline at run time.

| Scenario | Attack shape | Typical result in our runs |
|---|---|---|
| 📦 **Package fee** | Small steady waves (3 texts every ~0.5s) | Caught after **~6 exposed**, ~95% confidence |
| 🚗 **Toll spray** | Goes viral: every wave doubles | Caught after **~7 exposed**, ~95% confidence |
| 🏦 **Bank alert drip** | One text at a time, to stay under the radar | Caught after **~4 exposed**, ~85% confidence |

**→ About 4,994 of 5,000 residents warned before the scam ever reaches them.**

---

## Why this matters for T-Mobile

- **It covers the blind spot.** Carriers already catch SMS campaigns by watching volume. On encrypted channels the network goes blind; Patient Zero brings that visibility back with fingerprints only.
- **It warns people who already got the scam**, not only blocks future copies.
- **Honest confidence.** Nemotron reports how sure it is and why. A pending or failed investigation is never presented as a verdict.
- **Privacy by design.** Nemotron never sees message text, only cluster sizes, recipient counts, timing and fingerprints. Known senders (newsletters, your bank's real alerts) are never flagged.
- **It fits the product.** Imagine it as a feature inside T-Life's Scam Shield, not another app.

---

## Under the hood

| Layer | What it does | Built with |
|---|---|---|
| **Attacker** | Lightly rewords each scam (cached variants) and blasts it in waves | Gemini, Python |
| **Real-time state** | Residents, messages, notifications, incidents, sim runs and logs. Every client syncs live | **SpacetimeDB** (TypeScript module) |
| **Sentinel** | SimHash clustering (Hamming ≤ 22). Flags when ≥ 4 messages reach ≥ 3 recipients within 10s from an unknown sender | Python |
| **Investigator** | Decides whether separate fingerprint clusters are one coordinated campaign. Writes the warning and recovery steps | **NVIDIA Nemotron** (`nemotron-3.5-bolt-e4b`) |
| **Command Center** | 3D campus map, live terminal, Nemotron card, notification phones | React 19, deck.gl, MapLibre, Tailwind |
| **Hosting** | Spacetime, the detector, the sim runner and the static site on one box | **Vultr** |

The 5,000 residents are synthetic. Each one has a persona, an age, a location and a "weak spot". The personas were generated once with Gemini and are committed (`simulation/data/personas.json`). No real people or messages are involved.

---

## Run it yourself

**Requirements:** Python 3.11+, Node 20+, the [SpacetimeDB CLI](https://spacetimedb.com/install), and API keys in `.env` (`GEMINI_API_KEY`, `NVIDIA_API_KEY`). `.env` is gitignored; never commit it.

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt requests
cp .env.example .env                                   # add your keys

spacetime start                                        # terminal 1: local DB on 127.0.0.1:3000
cd backend/spacetime && spacetime publish -s local patient-zero-db -y && cd ../..
python simulation/seed_spacetime.py                    # 5,000 residents

python -m detection.live_detect                        # terminal 2: detector + Nemotron
python -m simulation.sim_runner                        # terminal 3: runs attacks when you press Simulate

cd frontend && npm ci
VITE_DATA_MODE=live VITE_SPACETIME_URI=ws://127.0.0.1:3000 VITE_SPACETIME_DB=patient-zero-db npm run dev
```

Open the URL Vite prints, then press **Reset city** and pick a scenario. Prefer the command line? `python -m simulation.attacker toll` runs one scenario without the UI.

**Frontend only, no backend:** `cd frontend && npm ci && npm run dev` starts a clearly labeled mock mode.
**Tests:** `cd frontend && npm run test`

### Deploy (Vultr)
Code reaches the server through GitHub; the server only pulls and deploys:
```bash
bash scripts/deploy.sh                    # pull + rebuild the frontend
bash scripts/deploy.sh --backend          # also republish the Spacetime module
bash scripts/deploy.sh --backend --seed   # also reseed the 5,000 residents
```
The detector and sim runner run in `tmux` on the server (`detect` and `runner` sessions).

---

## Repo map

```
simulation/   attacker.py · scenarios.json · variants.json · sim_runner.py · seed_spacetime.py · residents.py
detection/    simhash.py · detector.py · investigator.py (Nemotron) · live_detect.py · spacetime_client.py
backend/      spacetime/spacetimedb/src/index.ts   (tables + reducers)
frontend/     React Command Center: campus map, SimulatePanel, LiveNotifications (see frontend/README.md)
scripts/      deploy.sh
```

<details>
<summary><b>SpacetimeDB tables & reducers</b></summary>

**Tables**
- `resident`: `{id, persona, exposed, warned, opened}`. Drives the map colors.
- `resident_profile`: `{resident_id, name, age, district, x, y, weak_spot, …}`
- `message`: the scam blasts. The frontend never subscribes to it, so the browser never sees scam text.
- `notification`: `{recipient_id, kind: "alert" | "recovery", text}`
- `incident`: the Nemotron verdict for each campaign. Status, confidence, reasoning, warning text, variants, cluster metadata, time spread.
- `scenario`, `sim_run`, `pipeline_log`: the Simulate button, the run queue and the live terminal.

**Reducers**
- `start_campaign(text, n)`: blasts the text to n residents who haven't been exposed yet.
- `flag_campaign()`: writes recovery notifications for exposed residents and alerts for everyone else.
- `report_incident(…)`: saves Nemotron's investigation ("investigating", then "complete" or "failed").
- `request_simulation(scenario_id)` / `request_reset()`: queue work for `sim_runner.py`. Only one run can be active at a time.
- `seed_residents_batch`, `clear_residents`, `register_scenario`, `update_sim_run`, `log_line`
</details>

<details>
<summary><b>"How would a real phone fingerprint an iMessage?"</b></summary>

An iPhone app can't read your messages. In production this would ship inside the messaging client itself (an RCS or Android messages app with permission, or through a platform partnership). That's why the demo uses simulated phones. The fingerprint, detect and warn pipeline is the same whichever app it runs in. A daily random salt on the fingerprint stops anyone linking fingerprints across days.
</details>

---

<sub>Built in 24 hours at HackUTD 2026. All residents, messages and scams are synthetic. Open-source pieces: SpacetimeDB, React, deck.gl, MapLibre. Models: NVIDIA Nemotron and Google Gemini.</sub>
