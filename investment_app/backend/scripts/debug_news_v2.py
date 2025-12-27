
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.stock_service import stock_service

def debug_news(symbol):
    print(f"--- Debugging News for {symbol} ---")
    try:
        news = stock_service.fetch_news(symbol)
        print(f"Found {len(news)} news items")
        if len(news) > 0:
            print("First item:", news[0])
    except Exception as e:
        print(f"Error fetching news: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    symbol = sys.argv[1] if len(sys.argv) > 1 else "7203.T"
    debug_news(symbol)
