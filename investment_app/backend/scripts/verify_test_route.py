
import urllib.request
import json

def check_test_route():
    url = "http://localhost:8000/history_test"
    print(f"Checking {url}...")
    try:
        with urllib.request.urlopen(url) as response:
            print(f"Status: {response.getcode()}")
            print(response.read().decode())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_test_route()
