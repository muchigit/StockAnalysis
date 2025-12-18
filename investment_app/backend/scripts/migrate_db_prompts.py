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
        # Create gemini_prompt table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS geminiprompt (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Created geminiprompt table successfully.")
    except sqlite3.OperationalError as e:
        print(f"Error creating table: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
