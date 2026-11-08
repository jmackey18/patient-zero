import time
from detection.simhash import simhash
from detection.detector import detect
from detection.investigator import investigate

def run_detection(messages, total_residents):
    result = detect(messages, time.time(), total_residents)
    if not result["flagged"]:
        return result
    # flagged → send sample to Nemotron
    verdict = investigate(result["sample_text"], result["velocity"], result["recipient_count"])
    result.update(verdict)   # merge classification into result
    return result

if __name__ == "__main__":
    scam = "your package is held pay fee link"
    msgs = [{
        "sender_id": 999, "sender_known": False, "recipient_id": i,
        "text": scam, "simhash": simhash(scam), "timestamp": time.time(),
    } for i in range(6)]
    import json
    print(json.dumps(run_detection(msgs, total_residents=100), indent=2))