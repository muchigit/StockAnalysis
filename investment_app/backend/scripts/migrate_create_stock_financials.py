
import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from sqlmodel import SQLModel, create_engine, text
from backend.database import sqlite_url, StockFinancials

def migrate():
    engine = create_engine(sqlite_url)
    print(f"Migrating database at {sqlite_url}...")
    
    # Check if table exists
    with engine.connect() as conn:
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='stockfinancials';"))
        exists = result.fetchone()
        
        if not exists:
            print("Creating table 'stockfinancials'...")
            StockFinancials.__table__.create(engine)
            print("Table created.")
        else:
            print("Table 'stockfinancials' already exists.")

if __name__ == "__main__":
    migrate()
