from backend.database import engine
from sqlalchemy import text

def add_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE tradehistory ADD COLUMN note TEXT"))
            print("Added 'note' column to tradehistory.")
        except Exception as e:
            print(f"Column might already exist or error: {e}")

if __name__ == "__main__":
    add_column()
