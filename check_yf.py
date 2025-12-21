
import yfinance as yf
import pandas as pd

symbols = ["MAZE", "SION", "MGRT"]
for s in symbols:
    print(f"--- {s} ---")
    df = yf.download(s, period="5d", interval="1d", progress=False)
    if not df.empty:
        print(df.tail(1))
    else:
        print("Empty")
