import re
from urllib.parse import urlparse

SHORTENERS = {"bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd"}
SUSPICIOUS_TLDS = {"xyz", "top", "tk", "buzz", "click", "online", "info"}
KNOWN_BRANDS = {"usps.com", "fedex.com", "amazon.com", "paypal.com", "ups.com"}

def extract_url(text):
    """Pull first URL from text. Returns None if no URL."""
    match = re.search(r'(https?://[^\s]+|[a-z0-9-]+\.[a-z]{2,}[^\s]*)', text.lower())
    return match.group(0) if match else None

def check_url(url):
    """Inspect a URL for scam signals. Returns a dict of findings."""
    if not url.startswith("http"):
        url = "http://" + url
    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path.split("/")[0]
    tld = domain.split(".")[-1] if "." in domain else ""

    # lookalike: contains a brand name but isn't the real domain
    is_lookalike = any(
        brand.split(".")[0] in domain and domain not in KNOWN_BRANDS
        for brand in KNOWN_BRANDS
    )

    return {
        "domain": domain,
        "is_shortener": domain in SHORTENERS,
        "suspicious_tld": tld in SUSPICIOUS_TLDS,
        "is_lookalike": is_lookalike,
        "no_https": not url.startswith("https"),
        "is_raw_ip": bool(re.match(r'\d+\.\d+\.\d+\.\d+', domain)),
    }