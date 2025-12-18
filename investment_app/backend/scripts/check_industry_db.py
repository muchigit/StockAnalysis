
from sqlmodel import Session, select, create_engine
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'investment_app', 'backend'))
from database import Stock, sqlite_url

def check_industry():
    engine = create_engine(sqlite_url)
    with Session(engine) as session:
        stocks = session.exec(select(Stock).limit(10)).all()
        print(f"Checking {len(stocks)} stocks...")
        for s in stocks:
            print(f"Symbol: {s.symbol}, Sector: {s.sector}, Industry: {s.industry}")

if __name__ == "__main__":
    check_industry()
