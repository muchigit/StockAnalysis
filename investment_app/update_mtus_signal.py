from sqlmodel import Session, select
import sys
import os

# Fix path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import engine, Stock
from backend.services.stock_service import stock_service
from backend.services.signals import rebound_5ma

def update_mtus():
    with Session(engine) as session:
        stock = session.get(Stock, "MTUS")
        if not stock:
            print("MTUS not found in DB")
            return

        print("Fetching data for MTUS...")
        df = stock_service.get_stock_data("MTUS", period='2y', interval='1d', force_refresh=True)
        
        print(f"Data length: {len(df)}")
        if not df.empty:
            print(f"Last Close: {df['Close'].iloc[-1]}, 5MA: {df['Close_MA5'].iloc[-1]}")
            val = rebound_5ma(df)
            print(f"Calculated rebound_5ma: {val}")
            
            stock.signal_rebound_5ma = int(val)
            session.add(stock)
            session.commit()
            print("Updated MTUS in DB")
        else:
            print("No data found")

if __name__ == "__main__":
    update_mtus()
