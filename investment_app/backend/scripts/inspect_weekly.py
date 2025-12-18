import yfinance as yf
import pandas as pd

symbol = "AAPL"
print(f"Downloading {symbol} 1wk data...")
df = yf.download(symbol, period="2y", interval="1wk", progress=False)

print("--- Head ---")
print(df.head())
print("--- Index ---")
print(df.index[:5])

# Check diff
if len(df) > 2:
    diff = df.index[1] - df.index[0]
    print(f"Time diff: {diff}")
