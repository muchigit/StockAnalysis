
import sqlite3
import os

# Define database path
DB_PATH = "../../../data/investment_app.db"

def migrate():
    # Ensure correct path
    db_file = os.path.abspath(os.path.join(os.path.dirname(__file__), DB_PATH))
    print(f"Migrating database at: {db_file}")

    if not os.path.exists(db_file):
        print("Database not found!")
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(stock)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "analysis_file_path" not in columns:
            print("Adding 'analysis_file_path' column to 'stock' table...")
            # Add column
            cursor.execute("ALTER TABLE stock ADD COLUMN analysis_file_path TEXT DEFAULT NULL")
            conn.commit()
            print("Column added successfully.")
        else:
            print("Column 'analysis_file_path' already exists.")

    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
