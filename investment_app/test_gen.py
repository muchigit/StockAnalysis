import requests
try:
    res = requests.post("http://localhost:8001/automation/research/gen_content", json={"prompt": "test"})
    print(f"Status: {res.status_code}")
    print(f"Body: {res.text}")
except Exception as e:
    print(e)
