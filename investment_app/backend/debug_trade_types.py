
from sqlmodel import Session, select
from backend.database import engine, TradeHistory

def check_types():
    with Session(engine) as session:
        results = session.exec(select(TradeHistory.trade_type).distinct()).all()
        print("Distinct Trade Types found in DB:")
        for r in results:
            print(f"- '{r}'")

if __name__ == "__main__":
    check_types()
