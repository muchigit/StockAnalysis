
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.stock_service import stock_service
import yfinance as yf

def debug_fundamentals(symbol):
    print(f"--- Debugging {symbol} ---")
    try:
        metrics = stock_service.fetch_fundamentals(symbol)
        print("Metrics:", metrics)
    except Exception as e:
        print(f"Error fetching: {e}")
        import traceback
        traceback.print_exc()

    # Inspect raw yfinance info
    ticker = yf.Ticker(symbol)
    print("\n[Raw Info Keys]")
    try:
        info = ticker.info
        print(info.keys())
    except Exception as e:
        print(f"yfinance info error: {e}")

if __name__ == "__main__":
    symbol = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    debug_fundamentals(symbol)
