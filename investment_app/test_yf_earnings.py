import yfinance as yf
import pandas as pd
from datetime import datetime

def test_earnings(symbol):
    print(f"--- Testing {symbol} ---")
    ticker = yf.Ticker(symbol)
    
    # 1. Info's mostRecentQuarter
    info = ticker.info
    mrq = info.get('mostRecentQuarter')
    print(f"Info mostRecentQuarter: {mrq} -> {pd.to_datetime(mrq, unit='s') if mrq else 'None'}")
    
    # 2. Calendar
    try:
        cal = ticker.calendar
        print("Calendar:", cal)
    except Exception as e:
        print("Calendar Error:", e)

    # 3. Earnings Dates
    try:
        ed = ticker.earnings_dates
        if ed is not None and not ed.empty:
            print("Earnings Dates Columns:", ed.columns)
            print("Earnings Dates (First 5 rows):")
            print(ed.head())

            # Check for SEC filings if available
            try: 
                 sec = ticker.sec_filings
                 if sec is not None:
                     print("SEC Filings (First 5):")
                     print(sec[:5] if isinstance(sec, list) else sec.head())
                 else:
                     print("SEC Filings is None")
            except Exception as e:
                print("SEC Filings Error/Not Available:", e)

            
            # Check for SEC filings if available
            try: 
                 sec = ticker.sec_filings
                 if sec is not None:
                     print("SEC Filings (First 5):")
                     # sec_filings is usually a list of dicts
                     for i, s in enumerate(sec[:5]):
                         print(f"  {i}: {s}")
                 else:
                     print("SEC Filings is None")
            except Exception as e:
                print("SEC Filings Error/Not Available:", e)

            # Logic to find "latest" report date (before today)
            today = pd.Timestamp.now().normalize()
            
            # Make index tz-naive for comparison if needed
            if ed.index.tz is not None:
                ed.index = ed.index.tz_localize(None)

            past_dates = ed.index[ed.index < today]
            future_dates = ed.index[ed.index >= today]
            
            if len(past_dates) > 0:
                print(f"Latest Report Date (calculated from earnings_dates): {past_dates[0]}")
            else:
                print("No past dates found in earnings_dates")
                
            if len(future_dates) > 0:
                # If Descending: Future > Past.
                # Future dates: [2026, 2025 ...]
                # Nearest future is the SMALLEST of the future dates.
                nearest_future = future_dates.min()
                print(f"Nearest Future Date: {nearest_future}")
        else:
            print("Earnings Dates is empty")
            
    except Exception as e:
        print("Earnings Dates Error:", e)

if __name__ == "__main__":
    test_earnings("AAPL")
    test_earnings("MSFT")
