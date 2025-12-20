import requests, json
try:
    res = requests.get("http://localhost:8000/openapi.json")
    data = res.json()
    paths = data.get('paths', {}).keys()
    print("Paths found:")
    for p in paths:
        if "automation" in p or "generate" in p:
            print(p)
except Exception as e:
    print(e)
