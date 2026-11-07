# Shared data contracts (MVP v2) — everyone imports from here. Change only by team agreement.

def new_message(id, sender_id, recipient_id, text, simhash, timestamp, sender_known=False, campaign_id=None):
    # Message: {id, sender_id, sender_known, recipient_id, text, simhash, timestamp, campaign_id}
    # `text` exists only inside the simulation; the sentinel works on `simhash` alone.
    return {
        "id": id,
        "sender_id": sender_id,
        "sender_known": sender_known,
        "recipient_id": recipient_id,
        "text": text,
        "simhash": simhash,
        "timestamp": timestamp,
        "campaign_id": campaign_id,
    }

def new_resident(id, persona):
    # Resident: {id, persona, exposed, warned, opened}
    # Extra per-person details (name, district, weak spot, ...) live in resident_profile.
    return {"id": id, "persona": persona, "exposed": False, "warned": False, "opened": False}

# Detection output shape (what detector.py returns):
# {"flagged": bool, "campaign_id": ..., "msgs_before_detection": int,
#  "infected": [ids], "at_risk": [ids], "protected_count": int}
