from sqlalchemy import text
from investment_app.backend.database import engine

def migrate():
    with engine.connect() as conn:
        try:
            print("Adding column is_in_uptrend...")
            conn.execute(text("ALTER TABLE stock ADD COLUMN is_in_uptrend BOOLEAN"))
            print("Added is_in_uptrend.")
        except Exception as e:
            print(f"Skipping (might exist): {e}")

if __name__ == "__main__":
    migrate()
