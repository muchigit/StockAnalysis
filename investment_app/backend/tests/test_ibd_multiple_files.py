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

def test_ibd_multiple_import():
    print("Setting up test database...")
    SQLModel.metadata.create_all(test_engine)
    
    files_to_test = [
        r"c:\Users\uchida\git\StockAnalysis\参考ファイル\My Stock List.xls",
        r"c:\Users\uchida\git\StockAnalysis\参考ファイル\NEW HIGH.xls",
        r"c:\Users\uchida\git\StockAnalysis\参考ファイル\RELATIVE STRENGTH AT NEW HIGH.xls"
    ]
    
    importer = Importer()
    
    # Patch the engine used inside importer.py
    with patch('backend.services.importer.engine', new=test_engine):
        for file_path in files_to_test:
            print(f"\n--------------------------------------------------")
            print(f"Testing IBD import with file: {file_path}")
            
            if not os.path.exists(file_path):
                print(f"ERROR: File not found: {file_path}")
                continue

            try:
                # We pass a list of 1 file to isolate tests per file
                count = importer.import_finviz_ibd_files([file_path])
                print(f"Import function returned count: {count}")
                
                # Check DB for this file's impact (accumulative in this test script)
                with Session(test_engine) as session:
                    total_count = session.query(Stock).count()
                    print(f"Total Stock records in DB: {total_count}")
                    
                    if count > 0:
                         sample = session.query(Stock).limit(3).all()
                         # We show the last few added? No, just any sample to prove data is there.
                         # Actually, let's look for symbols specifically if we knew them, but we don't.
                         pass
                    else:
                        print(f"WARNING: No records imported from {os.path.basename(file_path)}")

            except Exception as e:
                print(f"FATAL ERROR during import of {file_path}: {e}")
                import traceback
                traceback.print_exc()

    # Final Summary
    print(f"\n--------------------------------------------------")
    with Session(test_engine) as session:
        final_count = session.query(Stock).count()
        print(f"FINAL Total Stock records in DB: {final_count}")
        if final_count > 0:
            print("SUCCESS: Multiple IBD Import verification passed.")
        else:
             print("FAILURE: Validation failed (No records imported).")

if __name__ == "__main__":
    test_ibd_multiple_import()
