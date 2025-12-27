
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.stock_service import stock_service
import pandas as pd

def debug_history(symbol):
    print(f"--- Debugging History for {symbol} ---")
    try:
        history = stock_service.fetch_financial_history(symbol)
        print(f"Found {len(history)} records")
        for rec in history:
            print(rec)
    except Exception as e:
        print(f"Error fetching history: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    symbol = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    debug_history(symbol)
