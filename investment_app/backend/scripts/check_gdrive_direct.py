
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'investment_app', 'backend'))
from services.gdrive_loader import gdrive_loader

def check_gdrive():
    try:
        summaries = gdrive_loader.get_latest_summaries()
        print(f"Found {len(summaries)} summaries from GDrive.")
        for k, v in list(summaries.items())[:5]:
            print(f"{k}: {v[:50]}...")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_gdrive()
