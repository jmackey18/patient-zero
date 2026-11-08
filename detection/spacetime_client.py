import requests
import json

BASE = "http://127.0.0.1:3000/v1/database/patient-zero-db"

def query(sql):
    """Run a SQL read against Spacetime, return rows as list of dicts."""
    resp = requests.post(f"{BASE}/sql", headers={"Content-Type": "text/plain"}, data=sql)
    resp.raise_for_status()
    result = resp.json()[0]
    cols = [e["name"]["some"] for e in result["schema"]["elements"]]
    return [dict(zip(cols, row)) for row in result["rows"]]

def call_reducer(name, args):
    """Call a Spacetime reducer with args (list)."""
    resp = requests.post(
        f"{BASE}/call/{name}",
        headers={"Content-Type": "application/json"},
        data=json.dumps(args),
    )
    resp.raise_for_status()
    return resp.status_code

if __name__ == "__main__":
    # test the read
    residents = query("SELECT * FROM resident_profile LIMIT 3")
    print(residents)