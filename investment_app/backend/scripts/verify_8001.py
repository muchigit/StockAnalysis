
import urllib.request
import json

def check_endpoint_8000():
    url = "http://localhost:8000/history/analytics"
    print(f"Checking {url}...")
    try:
        with urllib.request.urlopen(url) as response:
            status = response.getcode()
            print(f"Status: {status}")
            if status == 200:
                data = json.loads(response.read().decode())
                print("Response Keys:", list(data.keys()))
                print("Endpoint is UP and working on 8000.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_endpoint_8000()
