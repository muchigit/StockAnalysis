import sys
import os

# Adjust path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from investment_app.backend.services.stock_service import stock_service
from investment_app.backend.services.signals import get_signal_functions

def test_signals(symbol):
    print(f"Testing signals for {symbol}...")
    df = stock_service.get_stock_data(symbol)
    if df.empty:
        print("Data is empty!")
        return

    print(f"Data shape: {df.shape}")
    print("Columns:", df.columns.tolist())
    print("Last row:", df.iloc[-1].to_dict())

    funcs = get_signal_functions()
    results = {}
    for name, func in funcs.items():
        try:
            res = func(df)
            print(f"Signal {name}: {res}")
            results[name] = res
        except Exception as e:
            print(f"Signal {name} ERROR: {e}")
            results[name] = -1

    print("Final Results:", results)

if __name__ == "__main__":
    test_signals("7203") # Toyota
    test_signals("AAPL") # Apple
