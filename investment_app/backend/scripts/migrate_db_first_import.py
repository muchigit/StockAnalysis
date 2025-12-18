import sqlite3
import os

# Use absolute path to database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# ../data/investment_app.db
DB_PATH = os.path.join(BASE_DIR, "data", "investment_app.db")

print(f"Migrating database at: {DB_PATH}")

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Add first_import_date column
        cursor.execute("ALTER TABLE stock ADD COLUMN first_import_date DATETIME")
        print("Added first_import_date column successfully.")
    except sqlite3.OperationalError as e:
        print(f"Column may already exist: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
