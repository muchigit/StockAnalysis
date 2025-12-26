import sys
import os
from pathlib import Path
from sqlalchemy import create_engine, text
import json

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from database import DATABASE_URL

def migrate():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # 1. Add columns to stockalert table
        print("Adding columns to stockalert...")
        try:
            conn.execute(text("ALTER TABLE stockalert ADD COLUMN stages_json TEXT"))
        except Exception as e:
            print(f"Column stages_json might already exist: {e}")
            
        try:
            conn.execute(text("ALTER TABLE stockalert ADD COLUMN current_stage_index INTEGER DEFAULT 0"))
        except Exception as e:
            print(f"Column current_stage_index might already exist: {e}")

        conn.commit()

        # 2. Migrate existing condition_json to first stage of stages_json
        print("Migrating existing alerts...")
        rows = conn.execute(text("SELECT id, condition_json, stages_json FROM stockalert")).fetchall()
        
        for row in rows:
            alert_id = row[0]
            cond_json = row[1]
            stages_json = row[2]
            
            if not stages_json:
                # Convert active condition to Stage 1
                try:
                    # Current format: [{"metric":..., "op":..., "value":...}]
                    # New format: [ [{"metric":...}, ...], [Stage2], ... ]
                    # So we allow the stages_json to be a List of Lists.
                    
                    current_conds = json.loads(cond_json)
                    new_stages = [current_conds] # Single stage
                    
                    conn.execute(
                        text("UPDATE stockalert SET stages_json = :s, current_stage_index = 0 WHERE id = :id"),
                        {"s": json.dumps(new_stages), "id": alert_id}
                    )
                    print(f"Migrated alert {alert_id}")
                except Exception as e:
                    print(f"Failed to migrate alert {alert_id}: {e}")
        
        conn.commit()
    
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
