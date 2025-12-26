import sqlite3
import os

# Database Path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# ../../data/investment_app.db
DB_PATH = os.path.join(BASE_DIR, "..", "..", "..", "data", "investment_app.db")

def migrate():
    print(f"Migrating database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(stock)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "is_buy_candidate" not in columns:
            print("Adding is_buy_candidate column...")
            cursor.execute("ALTER TABLE stock ADD COLUMN is_buy_candidate BOOLEAN DEFAULT 0")
            print("Column added successfully.")
        else:
            print("Column is_buy_candidate already exists.")
            
        conn.commit()
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
