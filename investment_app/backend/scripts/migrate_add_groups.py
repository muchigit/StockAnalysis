from sqlmodel import SQLModel, create_engine, text
import os
import sys

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import sqlite_url

def migrate():
    engine = create_engine(sqlite_url)
    
    with engine.connect() as connection:
        # Create StockGroup table
        try:
            connection.execute(text("SELECT id FROM stockgroup LIMIT 1"))
            print("StockGroup table already exists.")
        except Exception:
            print("Creating StockGroup table...")
            connection.execute(text("""
                CREATE TABLE stockgroup (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR NOT NULL,
                    description VARCHAR,
                    group_type VARCHAR NOT NULL,
                    created_at DATETIME NOT NULL
                )
            """))
            connection.execute(text("CREATE UNIQUE INDEX ix_stockgroup_name ON stockgroup (name)"))

        # Create StockGroupMember table
        try:
            connection.execute(text("SELECT id FROM stockgroupmember LIMIT 1"))
            print("StockGroupMember table already exists.")
        except Exception:
            print("Creating StockGroupMember table...")
            connection.execute(text("""
                CREATE TABLE stockgroupmember (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id INTEGER NOT NULL,
                    symbol VARCHAR NOT NULL,
                    added_at DATETIME NOT NULL,
                    FOREIGN KEY(group_id) REFERENCES stockgroup(id)
                )
            """))
            connection.execute(text("CREATE INDEX ix_stockgroupmember_symbol ON stockgroupmember (symbol)"))
            connection.execute(text("CREATE INDEX ix_stockgroupmember_group_id ON stockgroupmember (group_id)"))

if __name__ == "__main__":
    migrate()
