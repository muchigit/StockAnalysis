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
        # Add current_price
        try:
            connection.execute(text("ALTER TABLE stock ADD COLUMN current_price FLOAT"))
            print("Added column: current_price")
        except Exception as e:
            print(f"Skipped current_price: {e}")

        # Add RS columns
        for col in ['rs_5d', 'rs_20d', 'rs_50d', 'rs_200d']:
            try:
                connection.execute(text(f"ALTER TABLE stock ADD COLUMN {col} FLOAT"))
                print(f"Added column: {col}")
            except Exception as e:
                print(f"Skipped {col}: {e}")
                
if __name__ == "__main__":
    run_migration()
