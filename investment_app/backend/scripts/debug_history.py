
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.database import get_session, TradeHistory, create_db_and_tables
from sqlmodel import select
from backend.routers.history import calculate_analytics

def test_history():
    print("Testing History Analytics...")
    session_gen = get_session()
    session = next(session_gen)
    
    try:
        trades = session.exec(select(TradeHistory)).all()
        print(f"Found {len(trades)} trades.")
        if len(trades) > 0:
            print(f"Sample trade: {trades[0]}")
            
        result = calculate_analytics(trades)
        print("Analytics Calculation Success!")
        print("Stats:", result['stats'])
        print(f"History entries: {len(result['history'])}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    test_history()
