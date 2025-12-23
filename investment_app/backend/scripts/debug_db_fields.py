
import sys
import os

# Add 'investment_app' directory to path so we can import 'backend'
# Script in: investment_app/backend/scripts/
# We run from: investment_app/
# So we need cwd in path? Usually cwd is in path.

# Let's assume running from c:\Users\uchida\git\StockAnalysis\investment_app
# Then 'backend' is a package.
try:
    from backend.database import engine, Stock
except ImportError:
    # Try adjusting path if running directly
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
    from backend.database import engine, Stock

from sqlmodel import Session, select

def check_stock_data():
    with Session(engine) as session:
        statement = select(Stock).limit(5)
        results = session.exec(statement).all()
        
        print(f"Found {len(results)} stocks.")
        for stock in results:
            print(f"Symbol: {stock.symbol}")
            print(f"  Volume: {stock.volume}")
            print(f"  Vol %: {stock.volume_increase_pct}")
            print(f"  Market Cap: {stock.market_cap}")
            print(f"  Earnings: {stock.last_earnings_date}")
            print("-" * 20)

if __name__ == "__main__":
    check_stock_data()
