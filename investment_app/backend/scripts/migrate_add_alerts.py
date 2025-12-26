
from sqlmodel import create_engine, Session, text
import os

# Define database path - Go up 2 levels from backend/scripts to root, then to data
DB_PATH = "../../../data/investment_app.db"

def migrate():
    # Ensure correct path
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_abs_path = os.path.join(base_dir, DB_PATH)
    
    print(f"Migrating database at: {db_abs_path}")
    
    sqlite_url = f"sqlite:///{db_abs_path}"
    engine = create_engine(sqlite_url)

    with Session(engine) as session:
        # Check if table exists
        try:
            session.exec(text("SELECT * FROM stockalert LIMIT 1"))
            print("Table 'stockalert' already exists.")
        except Exception:
            print("Creating 'stockalert' table...")
            # Create table
            session.exec(text("""
                CREATE TABLE stockalert (
                    id INTEGER PRIMARY KEY,
                    symbol VARCHAR NOT NULL,
                    condition_json VARCHAR NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME NOT NULL,
                    last_triggered_at DATETIME,
                    triggered BOOLEAN NOT NULL DEFAULT 0
                )
            """))
            session.exec(text("CREATE INDEX ix_stockalert_symbol ON stockalert (symbol)"))
            session.commit()
            print("Table 'stockalert' created successfully.")

if __name__ == "__main__":
    migrate()
