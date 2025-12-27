import sqlite3
import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import engine, SQLModel, StockNews

# Database Path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# ../../data/investment_app.db
DB_PATH = os.path.join(BASE_DIR, "..", "..", "..", "data", "investment_app.db")

def migrate():
    print(f"Migrating database at: {DB_PATH}")
    
    # 1. Add Columns to Stock Table
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    new_columns = {
        "forward_pe": "FLOAT",
        "trailing_pe": "FLOAT",
        "price_to_book": "FLOAT",
        "dividend_yield": "FLOAT",
        "return_on_equity": "FLOAT",
        "revenue_growth": "FLOAT",
        "ebitda": "FLOAT",
        "target_mean_price": "FLOAT",
        "high_52_week": "FLOAT",
        "low_52_week": "FLOAT"
    }

    try:
        cursor.execute("PRAGMA table_info(stock)")
        existing_columns = [info[1] for info in cursor.fetchall()]
        
        for col, dtype in new_columns.items():
            if col not in existing_columns:
                print(f"Adding column {col}...")
                cursor.execute(f"ALTER TABLE stock ADD COLUMN {col} {dtype}")
            else:
                print(f"Column {col} already exists.")
        
        conn.commit()
    except Exception as e:
        print(f"Column migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

    # 2. Create StockNews Table
    # Using SQLModel metadata to create missing tables
    print("Creating StockNews table if missing...")
    try:
        SQLModel.metadata.create_all(engine)
        print("StockNews table creation (checked/completed).")
    except Exception as e:
        print(f"Table creation failed: {e}")

if __name__ == "__main__":
    migrate()
