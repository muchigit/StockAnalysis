import yfinance as yf
import pandas as pd

def test_fetch(symbol):
    print(f"Fetching {symbol}...")
    df = yf.download(symbol, start="2023-01-01", progress=False, auto_adjust=True)
    print("Empty?", df.empty)
    print("Columns:", df.columns)
    if not df.empty:
        print("First row:", df.iloc[0])
        print("Head:\n", df.head())
        
        # Check structure for multi-index
        if isinstance(df.columns, pd.MultiIndex):
            print("MultiIndex detected!")
            print("Levels:", df.columns.nlevels)
            
test_fetch("AAPL")
