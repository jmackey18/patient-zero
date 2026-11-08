from detection.simhash import simhash, hamming

# --- tunable thresholds (keep these consistent across the team) ---
HAMMING_THRESHOLD = 22      # texts within this distance = same campaign
VELOCITY_THRESHOLD = 4      # min cluster size to flag
RECIPIENT_THRESHOLD = 3     # min distinct recipients
WINDOW_SECONDS = 10         # sliding time window

def detect(messages, now, total_residents):
    """
    messages: list of {sender_id, sender_known, recipient_id, text, simhash, timestamp}
    now: current timestamp
    total_residents: total count (for protected calc)
    Returns DetectionResult dict.
    """
    recent = [m for m in messages if now - m["timestamp"] < WINDOW_SECONDS]
    if not recent:
        return {"flagged": False}

    # cluster messages similar to the first recent one
    seed = recent[0]["simhash"]
    cluster = [m for m in recent if hamming(m["simhash"], seed) <= HAMMING_THRESHOLD]

    velocity = len(cluster)
    recipients = set(m["recipient_id"] for m in cluster)
    sender_unknown = all(not m["sender_known"] for m in cluster)

    flagged = (
        velocity >= VELOCITY_THRESHOLD
        and len(recipients) >= RECIPIENT_THRESHOLD
        and sender_unknown
    )

    if not flagged:
        return {"flagged": False}

    infected = list(recipients)
    return {
        "flagged": True,
        "msgs_before_detection": len(messages),
        "infected": infected,
        "protected_count": total_residents - len(infected),
        "sample_text": cluster[0]["text"],   # passed to Nemotron next
        "velocity": velocity,
        "recipient_count": len(recipients),
    }