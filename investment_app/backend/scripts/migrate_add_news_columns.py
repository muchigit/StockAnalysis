
from sqlalchemy import create_engine, text
import os

# Calculated DB Path from previous success
script_dir = os.path.dirname(os.path.abspath(__file__)) # backend/scripts
backend_dir = os.path.dirname(script_dir) # backend
app_dir = os.path.dirname(backend_dir) # investment_app
parent_dir = os.path.dirname(app_dir) # StockAnalysis
data_dir = os.path.join(parent_dir, "data")
db_path = os.path.join(data_dir, "investment_app.db")

print(f"Migrating DB at: {db_path}")

engine = create_engine(f"sqlite:///{db_path}")

with engine.connect() as conn:
    print("Adding thumbnail_url column...")
    try:
        conn.execute(text("ALTER TABLE stocknews ADD COLUMN thumbnail_url VARCHAR"))
        print("thumbnail_url added.")
    except Exception as e:
        print(f"thumbnail_url might exist or error: {e}")

    print("Adding related_tickers_json column...")
    try:
        conn.execute(text("ALTER TABLE stocknews ADD COLUMN related_tickers_json VARCHAR DEFAULT '[]'"))
        print("related_tickers_json added.")
    except Exception as e:
        print(f"related_tickers_json might exist or error: {e}")
        
    conn.commit()

print("Migration complete.")
