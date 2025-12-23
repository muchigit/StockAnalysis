
import urllib.request
import json

def check_routes():
    try:
        url = "http://localhost:8000/openapi.json"
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            paths = data.get("paths", {})
            print("Registered Paths:")
            for p in paths.keys():
                if "history" in p:
                    print(f"FOUND: {p}")
            
            if "/history/analytics" not in paths:
                print("MISSING /history/analytics")
            else:
                print("CONFIRMED /history/analytics exists")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_routes()
