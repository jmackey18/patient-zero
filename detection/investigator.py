import os, json
from openai import OpenAI
from dotenv import load_dotenv
from detection.url_check import extract_url, check_url

load_dotenv()
client = OpenAI(base_url="https://integrate.api.nvidia.com/v1",
                api_key=os.getenv("NVIDIA_API_KEY"))
MODEL = "nvidia/nemotron-3.5-bolt-e4b"   # your exact model

def investigate(sample_text, velocity, recipient_count):
    # STEP 1: extract + inspect the URL (the tool)
    url = extract_url(sample_text)
    url_findings = check_url(url) if url else {"note": "no URL found"}

    # STEP 2: give Nemotron the message + the tool's findings, let it reason
    prompt = f"""You are a fraud investigation agent. Analyze this fast-spreading message using the URL inspection results.

Message: "{sample_text}"
Spread: {velocity} near-identical messages to {recipient_count} people in seconds.
URL inspection tool results: {json.dumps(url_findings)}

Reason over the URL evidence, then respond ONLY as JSON:
{{"is_scam": true, "scam_type": "...", "confidence": 0-100, "evidence": "cite the specific URL findings that prove this", "warning_text": "short user warning naming the evidence", "recovery_steps": ["...","..."]}}"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    raw = resp.choices[0].message.content
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {"is_scam": True, "scam_type": "unknown", "confidence": 50,
                  "evidence": "", "warning_text": "Possible scam — do not click.",
                  "recovery_steps": [], "raw": raw}
    result["url_findings"] = url_findings   # attach raw tool output for the demo
    return result

if __name__ == "__main__":
    print(json.dumps(investigate(
        "your package is held pay fee usps-tracking.xyz/pay", 6, 6), indent=2))