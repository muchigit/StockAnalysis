import sqlite3
import os

# Database Path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "..", "..", "data", "investment_app.db")

def migrate():
    print(f"Migrating database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check columns
        cursor.execute("PRAGMA table_info(stock)")
        columns = [info[1] for info in cursor.fetchall()]

        if "analysis_linked_at" not in columns:
            print("Adding analysis_linked_at column...")
            cursor.execute("ALTER TABLE stock ADD COLUMN analysis_linked_at TIMESTAMP")
            print("Added analysis_linked_at.")
        
        if "analysis_file_path" not in columns:
            print("Adding analysis_file_path column...")
            cursor.execute("ALTER TABLE stock ADD COLUMN analysis_file_path TEXT")
            print("Added analysis_file_path.")

        conn.commit()
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
