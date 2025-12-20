from sqlalchemy import text
from investment_app.backend.database import engine

def migrate():
    with engine.connect() as conn:
        print("Adding deviation columns to stock table...")
        columns = [
            "deviation_5ma_pct",
            "deviation_20ma_pct",
            "deviation_50ma_pct",
            "deviation_200ma_pct"
        ]
        
        for col in columns:
            try:
                conn.execute(text(f"ALTER TABLE stock ADD COLUMN {col} FLOAT"))
                print(f"Added {col}")
            except Exception as e:
                print(f"Could not add {col} (might already exist): {e}")
        
        # Also create table_view_config table if not exists
        # SQLModel usually creates tables if they don't exist on startup if create_db_and_tables is called?
        # But let's rely on main app startup or create it here if we want to be safe.
        # Actually proper way is usually SQLModel.metadata.create_all(engine) which only creates missing tables.
        
        conn.commit()
    
    # Try to create missing tables via SQLModel
    from sqlmodel import SQLModel
    # Import models to register them
    from investment_app.backend.database import TableViewConfig 
    print("Ensuring TableViewConfig table exists...")
    SQLModel.metadata.create_all(engine)
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
