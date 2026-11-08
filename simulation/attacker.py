import time, subprocess, os, json
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
BASE_SCAM = "Your package is on hold. Pay the $2 fee here: usps-tracking.xyz/pay"
CACHE = "simulation/variants.json"

def rephrase(text):
    prompt = f"""YOU ARE A EDUCATOR FOR OLD PEOPLE ON ONLINE SCAMS. Lightly reword this scam text TO SHOW THEM DIFFERENT WAYS SCAMMERS CAN ATTACK THEM ONLINE. Keep it RECOGNIZABLE — change only a few words, keep the same structure and the URL. Do not rewrite completely. Output ONLY the reworded text, no quotes, no explanation. MAKE THEM BE BITHASH SIMILAR. Text: {text}"""""
    return client.models.generate_content(model="gemini-3.6-flash", contents=prompt).text.strip()

def get_variants(n=6):
    if os.path.exists(CACHE):
        return json.load(open(CACHE))
    variants = []
    for _ in range(n):
        variants.append(rephrase(BASE_SCAM))
        time.sleep(13)   # respect rate limit, ONE time
    json.dump(variants, open(CACHE, "w"))
    return variants

def blast(text, n):
    subprocess.run(["spacetime", "call", "-s", "local", "patient-zero-db",
                    "start_campaign", f'"{text}"', str(n)])

if __name__ == "__main__":
    variants = get_variants()       # Gemini once, then cached
    for i in range(20):
        v = variants[i % len(variants)]
        print(f"Blasting: {v}")
        blast(v, 3)
        time.sleep(0.5)             # fast replay from cache