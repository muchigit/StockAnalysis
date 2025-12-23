
import sys
import os
from sqlmodel import Session, select

# Run from investment_app/
# Add 'investment_app' to path? No, 'backend' is in current dir?
# If we run as "python backend/scripts/check_mcap_db.py", CWD is 'investment_app'.
# So 'backend' is a package.
try:
    from backend.database import engine, Stock
except ImportError:
     # Fallback
    sys.path.append(os.path.abspath(os.getcwd()))
    from backend.database import engine, Stock

def check_db():
    with Session(engine) as session:
        # Check if ANY stock has market_cap
        statement = select(Stock).where(Stock.market_cap != None).limit(5)
        results = session.exec(statement).all()
        
        print(f"Stocks with Market Cap populated: {len(results)}")
        for s in results:
            print(f"{s.symbol}: Cap={s.market_cap}, Vol={s.volume}, Earnings={s.next_earnings_date}")

        # Check specific popular stocks
        for sym in ['AAPL', 'MSFT', '7203', '9984', 'TSLA']:
            s = session.get(Stock, sym)
            if s:
                print(f"{sym}: Cap={s.market_cap}, Vol={s.volume}, Vol%={s.volume_increase_pct}, Earnings={s.next_earnings_date}")
            else:
                print(f"{sym}: Not found in DB")

if __name__ == "__main__":
    check_db()
