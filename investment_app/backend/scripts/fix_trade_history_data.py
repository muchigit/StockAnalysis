import sqlite3
import os

# Database path
# Script is in backend/scripts
# DB is in StockAnalysis/data/investment_app.db
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'investment_app.db')
DB_PATH = os.path.abspath(DB_PATH)

def cleanup_trade_history():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Debug: List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables in DB:", [t[0] for t in tables])

    # Valid trade types
    VALID_TYPES = {'買い', '売り', '配当', '入金', '出金'}

    try:
        # Check current distribution
        print("Checking current trade types...")
        cursor.execute("SELECT trade_type, COUNT(*) FROM tradehistory GROUP BY trade_type")
        rows = cursor.fetchall()
        
        print("Current Trade Types Distribution:")
        to_delete_count = 0
        for row in rows:
            trade_type, count = row
            status = "VALID" if trade_type in VALID_TYPES else "INVALID (To be deleted)"
            print(f" - {trade_type}: {count} [{status}]")
            if trade_type not in VALID_TYPES:
                to_delete_count += count

        if to_delete_count == 0:
            print("No invalid records found. Exiting.")
            return

        print(f"\nFound {to_delete_count} invalid records. Deleting...")
        
        # In SQLite, using NOT IN with a set of strings
        # We construct the query placeholders
        placeholders = ', '.join(['?'] * len(VALID_TYPES))
        query = f"DELETE FROM tradehistory WHERE trade_type NOT IN ({placeholders})"
        
        cursor.execute(query, list(VALID_TYPES))
        deleted_count = cursor.rowcount
        
        print(f"Deleted {deleted_count} records.")
        conn.commit()
        print("Changes committed successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    cleanup_trade_history()
