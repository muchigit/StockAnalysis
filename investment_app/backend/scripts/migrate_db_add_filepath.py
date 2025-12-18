
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "investment_app.db")
# Check if running from root or elsewhere. Current CWD is root of repo usually? 
# User info says "Active Document: .../gemini_automation.py".
# CWD for run_command was ".../investment_app".
# Let's use precise path.
DB_PATH = "c:\\Users\\uchida\\git\\StockAnalysis\\data\\investment_app.db"

def migrate():
    print(f"Migrating {DB_PATH}...")
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(analysisresult)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "file_path" in columns:
            print("Column 'file_path' already exists.")
        else:
            print("Adding 'file_path' column...")
            cursor.execute("ALTER TABLE analysisresult ADD COLUMN file_path TEXT")
            conn.commit()
            print("Migration successful.")
            
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
