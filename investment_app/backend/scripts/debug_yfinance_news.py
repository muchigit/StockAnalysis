
import yfinance as yf
import traceback

def debug_news(symbol):
    print(f"--- Debugging yfinance News for {symbol} ---")
    try:
        ticker = yf.Ticker(symbol)
        print("Accessing ticker.news...")
        news = ticker.news
        print(f"ticker.news type: {type(news)}")
        print(f"ticker.news value: {news}")
        
        news_list = news or []
        print(f"Iterating {len(news_list)} items...")
        for i, item in enumerate(news_list):
            print(f"Item {i}: {item.keys() if isinstance(item, dict) else item}")
            
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    debug_news("7203.T")
