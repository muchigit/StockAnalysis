from sqlalchemy import text
from investment_app.backend.database import engine

def migrate():
    with engine.connect() as conn:
        cols = [
            "change_percentage_5d",
            "change_percentage_20d",
            "change_percentage_50d",
            "change_percentage_200d"
        ]
        for col in cols:
            try:
                print(f"Adding column {col}...")
                conn.execute(text(f"ALTER TABLE stock ADD COLUMN {col} FLOAT"))
                print(f"Added {col}.")
            except Exception as e:
                print(f"Skipping {col} (might exist): {e}")
                
migrate()
