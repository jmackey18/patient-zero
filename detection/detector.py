from detection.simhash import simhash, hamming

HAMMING_THRESHOLD = 22
VELOCITY_THRESHOLD = 4
RECIPIENT_THRESHOLD = 3
WINDOW_SECONDS = 10

def _cluster_messages(messages):
    clusters = []
    for m in messages:
        placed = False
        for c in clusters:
            if hamming(m["simhash"], c["seed_hash"]) <= HAMMING_THRESHOLD:
                c["messages"].append(m)
                placed = True
                break
        if not placed:
            clusters.append({"seed_hash": m["simhash"], "messages": [m]})
    return clusters

def detect(messages, now, total_residents):
    recent = [m for m in messages if now - m["timestamp"] < WINDOW_SECONDS]
    if not recent:
        return {"flagged": False}

    clusters = _cluster_messages(recent)

    cluster_meta = []
    for c in clusters:
        msgs = c["messages"]
        recipients = set(m["recipient_id"] for m in msgs)
        times = [m["timestamp"] for m in msgs]
        cluster_meta.append({
            "size": len(msgs),
            "distinct_recipients": len(recipients),
            "sender_unknown": all(not m["sender_known"] for m in msgs),
            "time_spread_s": round(max(times) - min(times), 2),
            "fingerprint": msgs[0]["simhash"],
        })

    suspicious = [c for c in cluster_meta if c["sender_unknown"]]
    total_msgs = sum(c["size"] for c in suspicious)
    all_recipients = set()
    for c in clusters:
        if all(not m["sender_known"] for m in c["messages"]):
            all_recipients.update(m["recipient_id"] for m in c["messages"])

    # Campaign-wide spread: first to last exposed message across all suspicious clusters.
    suspicious_times = [m["timestamp"] for c in clusters
                        if all(not m["sender_known"] for m in c["messages"]) for m in c["messages"]]
    time_spread_s = round(max(suspicious_times) - min(suspicious_times), 2) if suspicious_times else 0.0

    flagged = total_msgs >= VELOCITY_THRESHOLD and len(all_recipients) >= RECIPIENT_THRESHOLD
    if not flagged:
        return {"flagged": False}

    return {
        "flagged": True,
        "msgs_before_detection": len(messages),
        "infected": list(all_recipients),
        "protected_count": total_residents - len(all_recipients),
        "num_clusters": len(suspicious),
        "cluster_meta": suspicious,
        "velocity": total_msgs,
        "recipient_count": len(all_recipients),
        "time_spread_s": time_spread_s,
        "sample_text": clusters[0]["messages"][0]["text"],
    }