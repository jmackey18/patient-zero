import json
import time
from detection.spacetime_client import query, call_reducer
from detection.simhash import simhash
from detection.detector import detect
from detection.investigator import investigate

def report_incident(campaign_id, status, result, verdict=None):
    """Writes Nemotron's progress/verdict to the Spacetime `incident` table (the frontend reads it live)."""
    verdict = verdict or {}
    call_reducer("report_incident", [
        campaign_id,
        status,
        bool(verdict.get("is_coordinated_attack", False)),
        int(max(0, min(100, verdict.get("confidence", 0) or 0))),
        str(verdict.get("reasoning", "")),
        str(verdict.get("warning_text", "")),
        int(verdict.get("num_variants", result.get("num_clusters", 0)) or 0),
        json.dumps(result.get("cluster_meta", [])),
    ])


print("Monitoring Avon for scam campaigns...")
flagged_campaigns = set()

while True:
    rows = query("SELECT * FROM message")
    messages = [{
        "sender_id": r["sender_id"],
        "sender_known": r["sender_known"],
        "recipient_id": r["recipient_id"],
        "text": r["text"].strip('"'),
        "simhash": simhash(r["text"].strip('"')),
        "timestamp": time.time(),
    } for r in rows]

    if messages:
        result = detect(messages, time.time(), total_residents=5000)
        if result["flagged"]:
            campaign_id = rows[0]["campaign_id"].strip('"')
            if campaign_id not in flagged_campaigns:
                flagged_campaigns.add(campaign_id)
                print(f"\n🚨 CAMPAIGN DETECTED")
                print(f"   {len(result['infected'])} exposed, {result['protected_count']} protected")
                print(f"   {result['num_clusters']} fingerprint clusters (rephrasing variants)")
                call_reducer("flag_campaign", [])
                print("   ✅ Residents protected")
                print("   🔍 Analyzing behavioral signatures...")
                report_incident(campaign_id, "investigating", result)
                try:
                    verdict = investigate(result["cluster_meta"], result["velocity"], result["recipient_count"])
                except Exception as e:  # Nemotron down: keep running, tell the frontend
                    report_incident(campaign_id, "failed", result, {"reasoning": f"Nemotron unavailable: {e}"})
                    print(f"   ⚠️ Nemotron failed: {e}")
                    continue
                report_incident(campaign_id, "complete", result, verdict)
                print(f"\n   ── INCIDENT REPORT ──")
                print(f"   Coordinated attack: {verdict['is_coordinated_attack']} ({verdict['confidence']}%)")
                print(f"   Variants: {verdict['num_variants']}")
                print(f"   Reasoning: {verdict['reasoning']}")
    time.sleep(0.3)