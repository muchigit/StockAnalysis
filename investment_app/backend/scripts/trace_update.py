
import sys
import os
import logging
from sqlmodel import Session, select

# Adjust path
sys.path.append(os.path.abspath(os.getcwd()))
try:
    from backend.database import engine, Stock
    from backend.services.stock_service import stock_service
    from backend.services.update_manager import update_manager
except ImportError:
    from investment_app.backend.database import engine, Stock
    from investment_app.backend.services.stock_service import stock_service
    from investment_app.backend.services.update_manager import update_manager

# Configure logging to see errors
logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    # trace_aapl_update()
    # Now trace 7203
    try:
        from backend.database import Stock
        from sqlmodel import Session
        from backend.database import engine
        
        # Ensure 7203 exists
        with Session(engine) as session:
            if not session.get(Stock, '7203'):
                 s = Stock(symbol='7203', company_name='Toyota')
                 session.add(s)
                 session.commit()

        print("\n\n--- TRACING UPDATE FOR 7203 ---")
        # We can reuse the function if we parameterized it, but I'll just hack the script or write a new one?
        # Let's just create a new function in previous code or modify current one.
        # Actually replace_file_content is messy for renaming functions.
        # I'll just change the call at bottom and the symbol in the function.
        pass
    except: pass

    # Refactored trace function to accept symbol
    def trace_update(symbol):
        print(f"--- TRACING UPDATE FOR {symbol} ---")
        
        with Session(engine) as session:
            stock = session.get(Stock, symbol)
            if not stock:
                # auto create for test
                print(f"{symbol} not found, creating...")
                stock = Stock(symbol=symbol)
                session.add(stock)
                session.commit()
                session.refresh(stock)

            print(f"Current DB Value - Cap: {stock.market_cap}, Vol: {stock.volume}")

            # 1. Fetch Fundamentals
            print("\n[Step 1] Calling fetch_fundamentals...")
            funds = stock_service.fetch_fundamentals(symbol)
            print(f"  -> Result: {funds}")
            
            # 2. Fetch Price Data
            print("\n[Step 2] Calling get_stock_data...")
            df = stock_service.get_stock_data(symbol, period='2y', interval='1d', force_refresh=True)
            print(f"  -> DF Shape: {df.shape}")
            if not df.empty:
                print("  -> Tail(2) Volume:")
                print(df['Volume'].tail(2))
                
                # 3. Simulate Update Logic
                print("\n[Step 3] Simulating Assignments...")
                if funds.get('market_cap'):
                    print(f"  -> Assigning market_cap: {funds['market_cap']}")
                    stock.market_cap = funds['market_cap']
                
                # Volume Logic check
                valid_vol_mask = df['Volume'].notna() & (df['Volume'] > 0)
                if valid_vol_mask.any():
                    current_volume = df.loc[valid_vol_mask, 'Volume'].iloc[-1]
                    print(f"  -> Found valid volume: {current_volume}")
                    stock.volume = float(current_volume)
                else:
                    print("  -> No valid volume found")

                # 4. Commit verification
                print("\n[Step 4] Committing to DB...")
                session.add(stock)
                session.commit()
                session.refresh(stock)
                print(f"New DB Value - Cap: {stock.market_cap}, Vol: {stock.volume}")

    trace_update('AAPL')
    trace_update('7203')
