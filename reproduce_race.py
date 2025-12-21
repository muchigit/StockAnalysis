
import yfinance as yf
import pandas as pd
from concurrent.futures import ThreadPoolExecutor

symbols = ["MAZE", "SION", "MGRT", "AAPL", "MSFT"]

def fetch(s):
    print(f"Fetching {s}...")
    try:
        # df = yf.download(s, period="5d", interval="1d", progress=False, threads=False) 
        # Mimic stock_service logic
        df = yf.download(s, period="5d", interval="1d", progress=False, threads=False)
        if not df.empty:
            if isinstance(df.columns, pd.MultiIndex):
                if 'Ticker' in df.columns.names:
                    available = df.columns.get_level_values('Ticker').unique()
                    print(f"[{s}] Raw tickers: {list(available)}")
                    if s in available:
                        df = df.xs(s, level='Ticker', axis=1)
                        print(f"[{s}] FIX SUCCESS: Extracted {s} data.")
                    else:
                        print(f"[{s}] FIX FAILURE: {s} not in {available}")
                else:
                    print(f"[{s}] No Ticker level")
            else:
                 print(f"[{s}] Single level cols")
            return df.iloc[-1]['Close'] if 'Close' in df else "NoClose"
    except Exception as e:
        print(f"Error {s}: {e}")

print("--- Sequential ---")
for s in symbols:
    fetch(s)

print("\n--- Parallel ---")
with ThreadPoolExecutor(max_workers=5) as exe:
    list(exe.map(fetch, symbols))
