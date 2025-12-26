from sqlmodel import Session, text
from backend.database import engine

def migrate():
    with Session(engine) as session:
        try:
            session.exec(text("ALTER TABLE stock ADD COLUMN predicted_price_next FLOAT"))
            print("Added predicted_price_next column.")
        except Exception as e:
            print(f"predicted_price_next might already exist: {e}")

        try:
            session.exec(text("ALTER TABLE stock ADD COLUMN predicted_price_today FLOAT"))
            print("Added predicted_price_today column.")
        except Exception as e:
            print(f"predicted_price_today might already exist: {e}")
            
        session.commit()

if __name__ == "__main__":
    migrate()
