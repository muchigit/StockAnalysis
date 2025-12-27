

from sqlalchemy import create_engine, inspect
import os

# .../backend/scripts/inspect.py
# 1. scripts
# 2. backend
# 3. investment_app
# 4. StockAnalysis (parent)
# Data is in StockAnalysis/data

root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# Wait.
# abspath: .../backend/scripts/inspect.py
# d1: .../backend/scripts
# d2: .../backend
# d3: .../investment_app
# d4: .../StockAnalysis

# Actually, let's just go relative to 'investment_app' folder which is CWD for execution usually
# But script is inside backend/scripts
# If I assume CWD is 'investment_app' (as per run_command usually)
# I can use "..\data\investment_app.db"? No, data is sibling of investment_app.
# "..\\data\\investment_app.db"

# Let's rely on absolute calculation again but be careful.
script_dir = os.path.dirname(os.path.abspath(__file__)) # backend/scripts
backend_dir = os.path.dirname(script_dir) # backend
app_dir = os.path.dirname(backend_dir) # investment_app
parent_dir = os.path.dirname(app_dir) # StockAnalysis
data_dir = os.path.join(parent_dir, "data")
db_path = os.path.join(data_dir, "investment_app.db")

print(f"Calculated DB Path: {db_path}")
print(f"Exists: {os.path.exists(db_path)}")

engine = create_engine(f"sqlite:///{db_path}")

inspector = inspect(engine)
print("--- Columns for stocknews ---")
for col in inspector.get_columns("stocknews"):
    print(col)

