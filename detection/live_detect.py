import json
import time
from detection.spacetime_client import query, call_reducer
from detection.simhash import simhash
from detection.detector import detect
from detection.investigator import investigate

def sent_at(r):
    """Real send time (seconds) from Spacetime's message.timestamp, set by start_campaign.
    The SQL API returns it as [micros] (or {"__timestamp_micros_since_unix_epoch__": micros})."""
    ts = r["timestamp"]
    if isinstance(ts, dict):
        ts = next(iter(ts.values()))
    if isinstance(ts, list):
        ts = ts[0]
    return int(ts) / 1_000_000


def log(line=""):
    """Prints like before, and streams the line to the frontend terminal (pipeline_log table)."""
    print(line)
    try:
        call_reducer("log_line", ["detector", line.strip("\n")])
    except Exception:
        pass  # module without log_line: terminal output still works


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
        float(result.get("time_spread_s", 0) or 0),
    ])


log("Monitoring Avon for scam campaigns...")
flagged_campaigns = set()

while True:
    rows = query("SELECT * FROM message")
    messages = [{
        "sender_id": r["sender_id"],
        "sender_known": r["sender_known"],
        "recipient_id": r["recipient_id"],
        "text": r["text"].strip('"'),
        "simhash": simhash(r["text"].strip('"')),
        "timestamp": sent_at(r),
    } for r in rows]

    if messages:
        result = detect(messages, time.time(), total_residents=5000)
        if result["flagged"]:
            campaign_id = rows[0]["campaign_id"].strip('"')
            if campaign_id not in flagged_campaigns:
                flagged_campaigns.add(campaign_id)
                log(f"\n🚨 CAMPAIGN DETECTED ({campaign_id})")
                log(f"   {len(result['infected'])} exposed, {result['protected_count']} protected, first to last exposed message: {result['time_spread_s']}s")
                log(f"   {result['num_clusters']} fingerprint clusters (rephrasing variants)")
                call_reducer("flag_campaign", [])
                log("   ✅ Residents protected")
                log("   🔍 Analyzing behavioral signatures...")
                report_incident(campaign_id, "investigating", result)
                try:
                    verdict = investigate(result["cluster_meta"], result["velocity"], result["recipient_count"],
                                          result["time_spread_s"])
                except Exception as e:  # Nemotron down: keep running, tell the frontend
                    report_incident(campaign_id, "failed", result, {"reasoning": f"Nemotron unavailable: {e}"})
                    log(f"   ⚠️ Nemotron failed: {e}")
                    continue
                report_incident(campaign_id, "complete", result, verdict)
                log(f"\n   ── INCIDENT REPORT ──")
                log(f"   Coordinated attack: {verdict['is_coordinated_attack']} ({verdict['confidence']}%)")
                log(f"   Variants: {verdict['num_variants']}")
                log(f"   Reasoning: {verdict['reasoning']}")
    time.sleep(0.3)