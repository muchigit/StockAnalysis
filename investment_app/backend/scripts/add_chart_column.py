import sqlite3
import os

# Path to database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# current: backend/scripts/
# target: ../../../data/investment_app.db
DB_PATH = os.path.join(BASE_DIR, "..", "..", "..", "data", "investment_app.db")

def migrate():
    print(f"Migrating database at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in cursor.fetchall()]
        print(f"Tables found: {tables}")
        
        target_table = None
        for t in tables:
            if t.lower() == 'stock':
                target_table = t
                break
        
        if not target_table:
            print("Stock table not found!")
            return

        # Check if column exists
        cursor.execute(f"PRAGMA table_info({target_table})")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "daily_chart_data" not in columns:
            print(f"Adding daily_chart_data column to {target_table}...")
            cursor.execute(f"ALTER TABLE {target_table} ADD COLUMN daily_chart_data TEXT")
            conn.commit()
            print("Column added successfully.")
        else:
            print("Column daily_chart_data already exists.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
