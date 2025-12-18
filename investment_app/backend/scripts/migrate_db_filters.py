import sqlite3

DB_PATH = "c:/Users/uchida/git/StockAnalysis/data/investment_app.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Creating saved_filter table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS savedfilter (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            criteria_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        print("Table created successfully.")
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
