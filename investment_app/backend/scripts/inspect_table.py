
import sys
import os
from sqlalchemy import create_engine, text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from backend.database import sqlite_url

def inspect_table():
    engine = create_engine(sqlite_url)
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(stockalert)"))
        rows = result.fetchall()
        print("Columns in stockfinancials:")
        for r in rows:
            print(r)

if __name__ == "__main__":
    inspect_table()
