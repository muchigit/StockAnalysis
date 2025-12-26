import time
import yfinance as yf
import pandas as pd

def measure_latency(symbol):
    print(f"--- Measuring {symbol} ---")
    ticker = yf.Ticker(symbol)
    
    # Measure earnings_dates
    start = time.time()
    try:
        _ = ticker.earnings_dates
        print(f"earnings_dates: {time.time() - start:.4f}s")
    except Exception as e:
        print(f"earnings_dates error: {e}")

    # Measure sec_filings
    start = time.time()
    try:
        _ = ticker.sec_filings
        print(f"sec_filings: {time.time() - start:.4f}s")
    except Exception as e:
        print(f"sec_filings error: {e}")

    # Measure calendar
    start = time.time()
    try:
        _ = ticker.calendar
        print(f"calendar: {time.time() - start:.4f}s")
    except Exception as e:
        print(f"calendar error: {e}")

    # Measure fast_info (sometimes has useful data)
    start = time.time()
    try:
        _ = ticker.fast_info
        print(f"fast_info: {time.time() - start:.4f}s")
    except Exception as e:
        print(f"fast_info error: {e}")

if __name__ == "__main__":
    measure_latency("AAPL")
    measure_latency("MSFT")
