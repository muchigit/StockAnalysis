import sys
import os
# Add current dir to path so we can import backend
sys.path.append(os.getcwd())

from backend.main import app

print("--- Valid Routes ---")
for route in app.routes:
    if hasattr(route, "path"):
        print(f"{route.path} [{route.name}]")
print("--- End Routes ---")
