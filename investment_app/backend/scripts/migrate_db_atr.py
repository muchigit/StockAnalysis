import sqlite3

DB_PATH = "c:/Users/uchida/git/StockAnalysis/data/investment_app.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Adding atr_14 column to stock table...")
        cursor.execute("ALTER TABLE stock ADD COLUMN atr_14 FLOAT")
        print("Column added successfully.")
    except sqlite3.OperationalError as e:
        print(f"Error (column might already exist): {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
