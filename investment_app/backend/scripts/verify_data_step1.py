
import sys
import os
import requests
from sqlmodel import Session, select

# Adjust path for backend import
sys.path.append(os.path.abspath(os.getcwd()))
try:
    from backend.database import engine, Stock
except ImportError:
    # Try alternate path if running from root
    from investment_app.backend.database import engine, Stock

def check_db_and_api(symbol):
    print(f"\n--- Checking {symbol} ---")
    
    # 1. DB Check
    try:
        with Session(engine) as session:
            stock = session.get(Stock, symbol)
            if stock:
                print(f"[DB] Found {symbol}:")
                print(f"  - Market Cap: {stock.market_cap}")
                print(f"  - Volume: {stock.volume}")
                print(f"  - Vol Increase %: {stock.volume_increase_pct}")
                print(f"  - Last Earnings: {stock.last_earnings_date}")
                print(f"  - Next Earnings: {stock.next_earnings_date}")
                print(f"  - Updated At: {stock.updated_at}")
            else:
                print(f"[DB] {symbol} NOT found in database.")
    except Exception as e:
        print(f"[DB] Error checking DB: {e}")

    # 2. API Check
    try:
        response = requests.get(f"http://localhost:8000/stocks/{symbol}")
        if response.status_code == 200:
            data = response.json()
            print(f"[API] Response for {symbol}:")
            print(f"  - market_cap: {data.get('market_cap')}")
            print(f"  - volume: {data.get('volume')}")
            print(f"  - volume_increase_pct: {data.get('volume_increase_pct')}")
            print(f"  - last_earnings_date: {data.get('last_earnings_date')}")
            print(f"  - next_earnings_date: {data.get('next_earnings_date')}")
        else:
            print(f"[API] Request failed: {response.status_code} {response.text}")
    except Exception as e:
        print(f"[API] Error calling API: {e}")

if __name__ == "__main__":
    check_db_and_api('AAPL')
    check_db_and_api('7203') # Toyota
