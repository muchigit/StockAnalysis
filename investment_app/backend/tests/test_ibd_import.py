import sys
import os
import pandas as pd
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, Session

# Run from c:\Users\uchida\git\StockAnalysis\investment_app

# Path setup
sys.path.append(os.getcwd())
try:
    from backend.services.importer import Importer
    from backend.database import Stock
except ImportError:
    sys.path.append(os.path.join(os.getcwd(), 'investment_app'))
    from backend.services.importer import Importer
    from backend.database import Stock

# Setup in-memory DB
DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(DATABASE_URL)

def test_ibd_import():
    print("Setting up test database...")
    print("Creating tables...")
    SQLModel.metadata.create_all(test_engine)
    
    file_path = r"c:\Users\uchida\git\StockAnalysis\参考ファイル\IBD 50.xls"
    print(f"Testing IBD import with file: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"ERROR: File not found: {file_path}")
        return

    importer = Importer()
    
    # Patch the engine used inside importer.py
    with patch('backend.services.importer.engine', new=test_engine):
        try:
            count = importer.import_finviz_ibd_files([file_path])
            print(f"Import function returned count: {count}")
        except Exception as e:
            print(f"FATAL ERROR during import: {e}")
            # If missing dependency, this will show it
            import traceback
            traceback.print_exc()
            return

    # Verify results
    with Session(test_engine) as session:
        count = session.query(Stock).count()
        print(f"Total Stock records imported: {count}")
        
        if count > 0:
            print("SUCCESS: IBD Import verification passed.")
            
            # Show sample
            sample = session.query(Stock).limit(5).all()
            for s in sample:
                print(f"Sample Stock: {s.symbol} (Company: {s.company_name})")
        else:
             print("FAILURE: Validation failed (No records imported).")

if __name__ == "__main__":
    test_ibd_import()
