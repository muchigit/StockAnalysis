
import yfinance as yf
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

def inspect_financials(symbol):

    print(f"--- Inspecting {symbol} ---")
    ticker = yf.Ticker(symbol)
    
    print("\n[Annual Income Statement Head]")
    try:
        fin = ticker.income_stmt
        if fin is not None and not fin.empty:
            keys = sorted(fin.index.tolist())
            print("--- KEYS ---")
            for k in keys:
                print(k)
            print("--- END KEYS ---")
        else:
            print("Empty")
    except Exception as e:
        print("Error:", e)

    print("\n[Quarterly Income Statement Head]")
    try:
        q_fin = ticker.quarterly_income_stmt
        if q_fin is not None and not q_fin.empty:
            print(q_fin.head(20))
        else:
            print("Empty")
    except Exception as e:
        print("Error:", e)
        
    print("\n[Earnings (Annual/Quarterly check)]")
    # Sometimes earnings contains EPS specifically
    try:
        earn = ticker.earnings
        print(earn)
    except:
        pass
        
    try:
        q_earn = ticker.quarterly_earnings
        print(q_earn)
    except:
        pass

inspect_financials("AAPL")
inspect_financials("7203.T") # Toyota
