
import sys
import os
import time
from sqlmodel import Session, select

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, Stock
from services.stock_service import stock_service
from services.signals import base_formation

def update_signals():
    print("Starting Base Formation signal update...")
    
    with Session(engine) as session:
        stocks = session.exec(select(Stock)).all()
        total = len(stocks)
        print(f"Found {total} stocks.")
        
        updated_count = 0
        error_count = 0
        
        for i, stock in enumerate(stocks):
            try:
                # Get data (use cache if available for speed)
                df = stock_service.get_stock_data(stock.symbol, period='2y', interval='1d', force_refresh=False)
                
                if df.empty:
                    # print(f"Skipping {stock.symbol}: No data")
                    continue
                
                # Calculate Signal
                signal_val = base_formation(df)
                
                # Update DB
                stock.signal_base_formation = int(signal_val)
                session.add(stock)
                
                updated_count += 1
                
                if i % 10 == 0:
                    session.commit()
                    print(f"Processed {i+1}/{total}...", end='\r')
                    
            except Exception as e:
                print(f"Error processing {stock.symbol}: {e}")
                error_count += 1
        
        session.commit()
        print(f"\nUpdate complete. Updated: {updated_count}, Errors: {error_count}")

if __name__ == "__main__":
    update_signals()
