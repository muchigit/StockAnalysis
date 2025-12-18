import sqlite3
import os

# Database file path
DB_PATH = 'data/investment_app.db'

def migrate_db():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if columns exist
        cursor.execute("PRAGMA table_info(stock)")
        columns = [info[1] for info in cursor.fetchall()]
        
        new_columns = {
            'composite_rating': 'INTEGER',
            'rs_rating': 'INTEGER',
            'ibd_rating_date': 'DATETIME'
        }
        
        for col, dtype in new_columns.items():
            if col not in columns:
                print(f"Adding column {col}...")
                cursor.execute(f"ALTER TABLE stock ADD COLUMN {col} {dtype}")
            else:
                print(f"Column {col} already exists.")
                
        conn.commit()
        print("Migration completed successfully.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_db()
