
from sqlmodel import Session, select
from backend.database import engine, TradeHistory

def check_rows():
    with Session(engine) as session:
        bad_types = ['アリコ', 'メタルス']
        results = session.exec(select(TradeHistory).where(TradeHistory.trade_type.in_(bad_types))).all()
        print(f"Found {len(results)} suspicious rows:")
        for r in results:
            print(f"ID: {r.id}, Symbol: {r.symbol}, Type: {r.trade_type}, Qty: {r.quantity}, Price: {r.price}, Date: {r.trade_date}")

if __name__ == "__main__":
    check_rows()
