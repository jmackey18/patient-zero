import os, json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(base_url="https://integrate.api.nvidia.com/v1",
                api_key=os.getenv("NVIDIA_API_KEY"))
MODEL = "nvidia/nemotron-3.5-bolt-e4b"

def investigate(cluster_meta, total_msgs, total_recipients, time_spread_s=None):
    spread = f", first to last message {time_spread_s}s apart" if time_spread_s is not None else ""
    prompt = f"""You are a telecom fraud analyst. Messages are end-to-end encrypted — you CANNOT read content, only behavioral metadata.

A burst was detected across {len(cluster_meta)} message clusters. Each cluster is near-identical messages grouped by privacy-preserving fingerprint. Different clusters have DIFFERENT fingerprints (different wording) but may be one coordinated campaign where an attacker rephrased to evade fingerprint detection.

Cluster metadata:
{json.dumps(cluster_meta, indent=2)}

Total: {total_msgs} messages to {total_recipients} distinct recipients{spread}.

Reason over the BEHAVIORAL signals to decide if these clusters are one coordinated attack. Respond ONLY as JSON:
{{"is_coordinated_attack": true, "confidence": 0-100, "reasoning": "cite behavioral signals linking the clusters despite different wording", "num_variants": {len(cluster_meta)}, "warning_text": "short carrier warning", "recovery_steps": ["...","..."]}}"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    raw = resp.choices[0].message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"is_coordinated_attack": True, "confidence": 50,
                "reasoning": "metadata indicates coordinated spread",
                "num_variants": len(cluster_meta),
                "warning_text": "Likely coordinated scam — do not engage.",
                "recovery_steps": [], "raw": raw}