import sys
import os
from sqlalchemy import create_engine, text

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import sqlite_url

def upgrade():
    engine = create_engine(sqlite_url)
    with engine.connect() as conn:
        print(f"Checking schema for {sqlite_url}...")
        
        # Check if column exists
        try:
            conn.execute(text("SELECT view_type FROM tableviewconfig LIMIT 1"))
            print("'view_type' column already exists.")
            return
        except Exception:
            print("'view_type' column missing. Adding it...")

        # Add column
        try:
            conn.execute(text("ALTER TABLE tableviewconfig ADD COLUMN view_type VARCHAR DEFAULT 'dashboard'"))
            # Create index (SQLite doesn't support adding index in ALTER TABLE, needs separate command)
            conn.execute(text("CREATE INDEX ix_tableviewconfig_view_type ON tableviewconfig (view_type)"))
            conn.commit()
            print("Successfully added 'view_type' column.")
        except Exception as e:
            print(f"Error adding column: {e}")

if __name__ == "__main__":
    upgrade()
