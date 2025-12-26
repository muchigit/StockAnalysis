import sqlite3
import os

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'investment_app.db')
DB_PATH = os.path.abspath(DB_PATH)

def migrate_add_column():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(stock)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'signal_base_formation' in columns:
            print("Column 'signal_base_formation' already exists.")
            return

        print("Adding column 'signal_base_formation' to 'stock' table...")
        cursor.execute("ALTER TABLE stock ADD COLUMN signal_base_formation INTEGER DEFAULT 0")
        
        conn.commit()
        print("Migration successful.")

    except Exception as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_add_column()
