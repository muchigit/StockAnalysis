
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.database import get_session, TradeHistory
from sqlmodel import select

def inspect_bad_trades():
    print("Inspecting TradeHistory for anomalies...")
    session_gen = get_session()
    session = next(session_gen)
    
    try:
        trades = session.exec(select(TradeHistory)).all()
        bad_count = 0
        for t in trades:
            # Check if symbol looks like a number (price)
            is_symbol_suspicious = False
            try:
                float(t.symbol)
                is_symbol_suspicious = True
            except ValueError:
                pass
            
            # Check if trade_type looks like a company name (long, contains spaces/dots, or not typical Buy/Sell/買い/売り)
            # Just simple check if it's not short
            is_type_suspicious = len(t.trade_type) > 10 
            
            if is_symbol_suspicious or is_type_suspicious:
                print(f"ID: {t.id} | Date: {t.trade_date} | Sym: {t.symbol} | Type: {t.trade_type} | Qty: {t.quantity} | Price: {t.price}")
                bad_count += 1
                
        print(f"Found {bad_count} suspicious records.")
        
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    inspect_bad_trades()
