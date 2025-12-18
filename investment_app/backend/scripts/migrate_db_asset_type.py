
import sqlite3
import os

DB_PATH = "c:\\Users\\uchida\\git\\StockAnalysis\\data\\investment_app.db"

def migrate():
    print(f"Migrating {DB_PATH}...")
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(stock)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "asset_type" in columns:
            print("Column 'asset_type' already exists.")
        else:
            print("Adding 'asset_type' column...")
            cursor.execute("ALTER TABLE stock ADD COLUMN asset_type TEXT DEFAULT 'stock'")
            conn.commit()
            print("Migration successful.")
            
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
