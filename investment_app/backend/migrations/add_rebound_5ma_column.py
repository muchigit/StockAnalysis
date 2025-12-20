from sqlmodel import create_engine, text
import os

# Adjust path to point to the correct DB location
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# current: backend/migrations
# target: StockAnalysis/data
DATA_DIR = os.path.join(BASE_DIR, "..", "..", "..", "data")
DATA_DIR = os.path.abspath(DATA_DIR)
sqlite_file_name = "investment_app.db"
sqlite_url = f"sqlite:///{os.path.join(DATA_DIR, sqlite_file_name)}"

engine = create_engine(sqlite_url)

def run_migration():
    with engine.connect() as connection:
        # Add signal_rebound_5ma
        try:
            connection.execute(text("ALTER TABLE stock ADD COLUMN signal_rebound_5ma INTEGER DEFAULT 0"))
            print("Added column: signal_rebound_5ma")
        except Exception as e:
            print(f"Skipped signal_rebound_5ma: {e}")

if __name__ == "__main__":
    run_migration()
