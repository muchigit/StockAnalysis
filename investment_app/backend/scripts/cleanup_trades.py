
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.database import get_session, TradeHistory
from sqlmodel import select

def cleanup_trades():
    print("Cleaning up corrupted TradeHistory records...")
    session_gen = get_session()
    session = next(session_gen)
    
    try:
        trades = session.exec(select(TradeHistory)).all()
        deleted_count = 0
        
        valid_types = ['BUY', 'SELL', '買い', '売り']
        
        for t in trades:
            # Check for bad type (Company Name instead of Buy/Sell)
            is_bad_type = True
            t_type_upper = t.trade_type.upper()
            
            # If type is one of the valid ones, it's good
            if t_type_upper in valid_types:
                is_bad_type = False
            else:
                # Also allow if it clearly contains "BUY" or "SELL" (e.g. "LIMIT BUY")
                if "BUY" in t_type_upper or "SELL" in t_type_upper:
                     is_bad_type = False
                if "買い" in t_type_upper or "売り" in t_type_upper:
                     is_bad_type = False

            # Check for bad symbol (Numeric)
            is_numeric_symbol = False
            try:
                float(t.symbol)
                is_numeric_symbol = True
            except ValueError:
                pass
            
            if is_bad_type and is_numeric_symbol:
                print(f"Deleting bad record ID {t.id}: Date={t.trade_date}, Sym={t.symbol}, Type={t.trade_type}")
                session.delete(t)
                deleted_count += 1
                
        session.commit()
        print(f"Deleted {deleted_count} corrupted records.")
        
    except Exception as e:
        session.rollback()
        print(f"ERROR: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    cleanup_trades()
