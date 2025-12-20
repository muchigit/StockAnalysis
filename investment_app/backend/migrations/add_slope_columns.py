from sqlalchemy import create_engine, text
import os

# Database Path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "..", "data") # Adjust based on database.py logic
# database.py uses: BASE_DIR(backend) -> .. -> .. -> data.
# This script is in backend/migrations/ (assuming I put it there).
# If I put it in backend/migrations, __file__ is backend/migrations/script.py
# dirname -> backend/migrations
# dirname -> backend
# .. -> investment_app
# .. -> StockAnalysis
# data -> StockAnalysis/data

# Let's rely on the same logic as database.py roughly.
# backend/database.py assumes __file__ is in backend.
# Let's adjust manually to be safe.
DB_PATH = r"C:\Users\uchida\git\StockAnalysis\data\investment_app.db"
URL = f"sqlite:///{DB_PATH}"

engine = create_engine(URL)

columns = [
    "slope_5ma",
    "slope_20ma",
    "slope_50ma",
    "slope_200ma"
]

with engine.connect() as conn:
    for col in columns:
        try:
            sql = text(f"ALTER TABLE stock ADD COLUMN {col} FLOAT")
            conn.execute(sql)
            print(f"Added column {col}")
        except Exception as e:
            # Likely already exists
            print(f"Skipping {col}: {e}")

print("Migration completed.")
