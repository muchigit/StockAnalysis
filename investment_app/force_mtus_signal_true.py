from sqlmodel import Session, select
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import engine, Stock

def force_mtus_signal():
    with Session(engine) as session:
        stock = session.get(Stock, "MTUS")
        if stock:
            print(f"Current signal: {stock.signal_rebound_5ma}")
            stock.signal_rebound_5ma = 1
            session.add(stock)
            session.commit()
            print("Forced MTUS signal_rebound_5ma to 1")

if __name__ == "__main__":
    force_mtus_signal()
