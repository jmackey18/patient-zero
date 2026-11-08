import time
from detection.spacetime_client import query, call_reducer
from detection.simhash import simhash
from detection.detector import detect
from detection.investigator import investigate

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
                verdict = investigate(result["cluster_meta"], result["velocity"], result["recipient_count"])
                print(f"\n   ── INCIDENT REPORT ──")
                print(f"   Coordinated attack: {verdict['is_coordinated_attack']} ({verdict['confidence']}%)")
                print(f"   Variants: {verdict['num_variants']}")
                print(f"   Reasoning: {verdict['reasoning']}")
    time.sleep(0.3)