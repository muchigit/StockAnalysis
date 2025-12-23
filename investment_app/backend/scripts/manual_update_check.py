
import sys
import os
import logging
from sqlmodel import Session, select
from datetime import datetime

# Adjust path
sys.path.append(os.path.abspath(os.getcwd()))
try:
    from backend.database import engine, Stock
    from backend.services.update_manager import update_manager
except ImportError:
    from investment_app.backend.database import engine, Stock
    from investment_app.backend.services.update_manager import update_manager

# Logging
logging.basicConfig(level=logging.INFO)

def run_manual_update(symbols):
    print(f"--- Running Manual Update for {symbols} ---")
    
    with Session(engine) as session:
        # Pre-fetch objects
        stocks = []
        for s in symbols:
            stock = session.get(Stock, s)
            if not stock:
                print(f"Creating {s}...")
                stock = Stock(symbol=s)
                session.add(stock)
                session.commit()
                session.refresh(stock)
            stocks.append(stock)
            
        print("Calling _process_stocks...")
        # We pass a dummy error list
        errors = []
        # UpdateManager expects objects?
        # definition: def _process_stocks(self, stocks, error_list):
        # line 131: symbols=[s.symbol if isinstance(s, Stock) else s for s in stocks]
        # So it accepts both.
        # But if we pass objects from 'session' (outer), and it opens 'session' (inner), 
        # mixing them might be weird if inner session tries to re-get them or modify them.
        # Inner session does: stock = session.get(Stock, sym) (using inner session)
        # So passing SYMBOLS is safer.
        update_manager._process_stocks(symbols, errors)
        
    print("\n--- Update Complete. Checking Results (Fresh Session) ---")
    with Session(engine) as session:
        for s in symbols:
            stock = session.get(Stock, s) 
            # Refresh just in case
            session.refresh(stock)
            print(f"[{s}]")
            print(f"  Market Cap: {stock.market_cap}")
            print(f"  Volume: {stock.volume}")
            print(f"  Vol Increase %: {stock.volume_increase_pct}")
            print(f"  Last Earnings: {stock.last_earnings_date}")
            print(f"  Next Earnings: {stock.next_earnings_date}")
            print(f"  Updated At: {stock.updated_at}")

if __name__ == "__main__":
    # Test with MTUS
    run_manual_update(['MTUS'])
