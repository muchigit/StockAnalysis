
import sys
import os
import pandas as pd

try:
    from backend.services.stock_service import stock_service
except ImportError:
    sys.path.append(os.path.abspath(os.getcwd()))
    from backend.services.stock_service import stock_service

def debug_fetch(symbol):
    print(f"--- Debugging {symbol} ---")
    try:
        # Mimic UpdateManager call
        df = stock_service.get_stock_data(symbol, period='2y', interval='1d', force_refresh=True)
        
        if df.empty:
            print("DF is empty")
            return

        print("Columns:", df.columns.tolist())
        print("Tail(2):")
        print(df.tail(2)[['Open', 'Close', 'Volume']])
        
        # Mimic Volume Extraction
        try:
            vol = df['Volume'].iloc[-1]
            print(f"Volume: {vol} (Type: {type(vol)})")
            print(f"Float Volume: {float(vol)}")
        except Exception as e:
            print(f"Volume extraction error: {e}")

        # Mimic Fundamentals
        funds = stock_service.fetch_fundamentals(symbol)
        print("Fundamentals:", funds)

    except Exception as e:
        print(f"General Error: {e}")

if __name__ == "__main__":
    debug_fetch('AAPL')
    debug_fetch('VUG')
