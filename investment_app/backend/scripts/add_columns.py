
import sqlite3
import os

# Define DB path (Hardcoded for simplicity matching database.py logic)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Scripts is in backend/scripts
# DB is in StockAnalysis/data
# backend (BASE_DIR is .../backend/scripts)
# .. -> backend
# .. -> investment_app
# .. -> StockAnalysis
# data -> StockAnalysis/data
DATA_DIR = os.path.join(BASE_DIR, "..", "..", "..", "data")
DB_PATH = os.path.join(DATA_DIR, "investment_app.db")

print(f"Migrating DB at: {DB_PATH}")

def add_column(cursor, table_name, column_name, column_type):
    try:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
        print(f"Added column {column_name} to {table_name}")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print(f"Column {column_name} already exists in {table_name}")
        else:
            print(f"Error adding {column_name}: {e}")

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Add new columns
    add_column(cursor, "stock", "volume", "FLOAT")
    add_column(cursor, "stock", "volume_increase_pct", "FLOAT")
    add_column(cursor, "stock", "last_earnings_date", "DATETIME")
    add_column(cursor, "stock", "next_earnings_date", "DATETIME")
    
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
