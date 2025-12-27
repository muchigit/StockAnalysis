import sys
import os
import pandas as pd
from datetime import datetime

# Adjust path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'investment_app')))

from backend.services.stock_service import stock_service

def debug_stock(symbol):
    print(f"--- Debugging {symbol} ---")
    
    # 1. Fundamentals
    print("Fetching Fundamentals...")
    try:
        funds = stock_service.fetch_fundamentals(symbol)
        print("Fundamentals Result:", funds)
    except Exception as e:
        print(f"Fundamentals Error: {e}")

    # 2. Data & Slopes
    print("\nFetching Stock Data...")
    try:
        df = stock_service.get_stock_data(symbol, force_refresh=True)
        print(f"Data Shape: {df.shape}")
        if not df.empty:
            print("Columns:", df.columns.tolist())
            
            # Check Slope_MA5
            if 'Slope_MA5' in df.columns:
                print("\nLast 5 rows of Slope_MA5:")
                print(df[['Close', 'Close_MA5', 'Slope_MA5']].tail())
                
                # Simulate Prediction Logic
                slope_5ma = df['Slope_MA5'].iloc[-1]
                slope_5ma_prev = df['Slope_MA5'].iloc[-2]
                ma5_t = df['Close_MA5'].iloc[-1]
                ma5_t_1 = df['Close_MA5'].iloc[-2]
                close_minus_4 = df['Close'].iloc[-5] if len(df) >= 5 else None
                
                print(f"\nSlope T: {slope_5ma}")
                print(f"Slope T-1: {slope_5ma_prev}")
                print(f"Stability (Prod >= 0): {slope_5ma * slope_5ma_prev >= 0}")
                
                if (slope_5ma * slope_5ma_prev) >= 0:
                    delta_ma = ma5_t - ma5_t_1
                    pred = 5 * delta_ma + close_minus_4
                    print(f"Predicted Next: {pred}")
                else:
                    print("Predicted Next: Unstable (None)")
            else:
                print("Slope_MA5 column MISSING!")
    except Exception as e:
        print(f"Stock Data Error: {e}")

if __name__ == "__main__":
    targets = ['RAVE', 'TRT', 'PANL', 'CGTX']
    for t in targets:
        debug_stock(t)
        print("\n" + "="*30 + "\n")
