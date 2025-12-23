
import urllib.request
import json
import sys

def check_endpoint():
    url = "http://localhost:8000/history/analytics"
    print(f"Checking {url}...")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            print(f"Status: {status}")
            if status == 200:
                data = json.loads(response.read().decode())
                print("Response Keys:", list(data.keys()))
                print("Endpoint is UP and working.")
            else:
                print("Endpoint returned non-200 status.")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} {e.reason}")
    except urllib.error.URLError as e:
        print(f"URL Error: {e.reason}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_endpoint()
