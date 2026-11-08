import hashlib

def simhash(text, bits=64):
    """Text -> 64-bit fingerprint. Similar text = similar fingerprint. Privacy-preserving: only the hash leaves the device."""
    v = [0] * bits
    for token in text.lower().split():
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        for i in range(bits):
            v[i] += 1 if (h >> i) & 1 else -1
    fingerprint = 0
    for i in range(bits):
        if v[i] > 0:
            fingerprint |= (1 << i)
    return fingerprint

def hamming(a, b):
    """Bits differing between two fingerprints. Small = similar."""
    return bin(a ^ b).count("1")

if __name__ == "__main__":
    # identical = 0
    print("identical:", hamming(simhash("your package is held pay fee link"),
                                 simhash("your package is held pay fee link")))
    # light rewrite = small
    print("light rewrite:", hamming(simhash("your package is held pay fee link"),
                                     simhash("your package is on hold pay fee link")))
    # unrelated = large
    print("unrelated:", hamming(simhash("your package is held pay fee link"),
                                simhash("happy birthday hope you have fun today")))
    