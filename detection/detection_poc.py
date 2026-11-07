import hashlib

def simhash(text, bits=64):
    # weight vector, one slot per bit
    v = [0] * bits
    # break text into words (tokens)
    tokens = text.lower().split()
    for token in tokens:
        # hash each token to a number
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        # for each bit position, push the vector up or down
        for i in range(bits):
            bit = (h >> i) & 1
            v[i] += 1 if bit else -1
    # collapse vector to final fingerprint: positive slot -> 1 bit
    fingerprint = 0
    for i in range(bits):
        if v[i] > 0:
            fingerprint |= (1 << i)
    return fingerprint

def hamming(a, b):
    # count differing bits between two fingerprints
    return bin(a ^ b).count("1")


import time, random

# 10 fake residents
residents = [{"id": i, "infected": False, "opened": False} for i in range(100)]
# and in spread:
targets = random.sample(range(100), 2)

# the scam, with reworded variants (simulating the LLM attacker)
scam_variants = [
    "your package is held pay 2 dollars here link",
    "pkg on hold pay $2 fee now link",
    "delivery paused settle 2 usd fee link",
    "parcel held pay two dollars to release link",
]

messages = []  # every message that gets sent

def send_message(sender_id, recipient_id, text, sender_known=False):
    msg = {
        "sender_id": sender_id,
        "recipient_id": recipient_id,
        "text": text,
        "simhash": simhash(text),
        "timestamp": time.time(),
        "sender_known": sender_known,
    }
    messages.append(msg)
    residents[recipient_id]["infected"] = True
    return msg

def spread_campaign():
    send_message(sender_id=999, recipient_id=1, text=random.choice(scam_variants))
    check_detection()  # check immediately

    for tick in range(5):
        infected_ids = [r["id"] for r in residents if r["infected"]]
        for sid in infected_ids:
            targets = random.sample(range(10), 2)
            for t in targets:
                send_message(sender_id=999, recipient_id=t, text=random.choice(scam_variants))
                check_detection()   # ← check after EVERY message
                if DETECTED:
                    return          # ← stop spreading once caught


DETECTED = False

def check_detection():
    global DETECTED
    if DETECTED:
        return
    now = time.time()
    recent = [m for m in messages if now - m["timestamp"] < 10]
    if not recent:
        return
    seed = recent[0]["simhash"]
    cluster = [m for m in recent if hamming(m["simhash"], seed) <= 16]  # was <= 6
    velocity = len(cluster)
    distinct_recipients = len(set(m["recipient_id"] for m in cluster))
    sender_unknown = all(not m["sender_known"] for m in cluster)

    if velocity >= 4 and distinct_recipients >= 3 and sender_unknown:
        DETECTED = True
        protected = sum(1 for r in residents if not r["infected"])
        print(f"🚨 CAMPAIGN DETECTED after {len(messages)} messages.")
        print(f"   {protected} residents protected.")


if __name__ == "__main__":
    spread_campaign()
    if not DETECTED:
        print("Not detected — tune thresholds down.")