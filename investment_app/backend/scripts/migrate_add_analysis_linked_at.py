
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
        # Check if column exists
        try:
            session.exec(text("SELECT analysis_linked_at FROM stock LIMIT 1"))
            print("Column 'analysis_linked_at' already exists.")
        except Exception:
            print("Adding 'analysis_linked_at' column to 'stock' table...")
            # Add column
            session.exec(text("ALTER TABLE stock ADD COLUMN analysis_linked_at DATETIME"))
            session.commit()
            print("Column added successfully.")

if __name__ == "__main__":
    migrate()
