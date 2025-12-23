
import sys
import os
import pandas as pd
import yfinance as yf

# Fix path
sys.path.append(os.path.abspath(os.getcwd()))
try:
    from backend.services.stock_service import stock_service
except ImportError:
    from investment_app.backend.services.stock_service import stock_service

def debug_intc():
    symbol = "INTC"
    print(f"--- Debugging {symbol} ---")
    
    # 1. Raw yfinance download to check structure
    print("[1] Raw yf.download...")
    raw_df = yf.download(symbol, period="1mo", interval="1d", progress=False, auto_adjust=True, threads=False)
    print("   Columns:", raw_df.columns)
    if isinstance(raw_df.columns, pd.MultiIndex):
        print("   Levels:", raw_df.columns.nlevels)
        print("   Level 0:", raw_df.columns.get_level_values(0).unique())
        print("   Level 1:", raw_df.columns.get_level_values(1).unique())
    print("   Tail(5):")
    print(raw_df.tail(5))

    # 2. StockService.get_stock_data
    print("\n[2] stock_service.get_stock_data...")
    df = stock_service.get_stock_data(symbol, period='2y', interval='1d', force_refresh=True)
    print("   DF Shape:", df.shape)
    print("   DF Columns:", df.columns.tolist())
    
    if not df.empty:
        if 'Volume' in df.columns:
            print("   Volume Column found.")
            print("   Last 5 Volume values:")
            print(df['Volume'].tail(5))
            
            # Check mask logic
            valid_vol_mask = df['Volume'].notna() & (df['Volume'] > 0)
            if valid_vol_mask.any():
                last_val = df.loc[valid_vol_mask, 'Volume'].iloc[-1]
                print(f"   Logic would pick: {last_val}")
            else:
                print("   Logic found NO valid volume.")
        else:
            print("   'Volume' column MISSING in result DF.")
    else:
        print("   DF is empty.")

    # 3. Fundamentals
    print("\n[3] fetch_fundamentals...")
    try:
        funds = stock_service.fetch_fundamentals(symbol)
        print("   Fundamentals:", funds)
    except Exception as e:
        print(f"   Fundamentals Error: {e}")

if __name__ == "__main__":
    debug_intc()
