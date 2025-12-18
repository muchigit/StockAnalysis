import sys
import os
import pandas as pd
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, Session

# Run this from c:\Users\uchida\git\StockAnalysis\investment_app
# It assumes 'backend' is importable as a package.

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from backend.services.importer import Importer
    from backend.database import TradeHistory
except ImportError:
    # Try alternate path if running from different location
    sys.path.append(os.path.join(os.getcwd(), 'investment_app'))
    from backend.services.importer import Importer
    from backend.database import TradeHistory


# Setup in-memory DB for testing
DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def test_import():
    print("Setting up test database...")
    print("Creating tables...")
    try:
        SQLModel.metadata.create_all(test_engine)
    except Exception as e:
        print(f"Error creating tables: {e}")
        # Make sure TradeHistory is registered in metadata
        # It should be if we imported it
        pass
    
    file_path = r"c:\Users\uchida\git\StockAnalysis\参考ファイル\履歴-現物口座(7335)-20251213-143800.csv"
    print(f"Testing import with file: {file_path}")
    
    importer = Importer()
    
    # Patch the engine used inside importer.py
    # importer.py imports: from ..database import engine
    # So we patch 'backend.services.importer.engine'
    with patch('backend.services.importer.engine', new=test_engine):
        try:
            importer.import_moomoo_csv(file_path)
            print("Import function executed successfully.")
        except Exception as e:
            print(f"FATAL ERROR during import: {e}")
            import traceback
            traceback.print_exc()
            return

    # Verify results
    with Session(test_engine) as session:
        count = session.query(TradeHistory).count()
        print(f"Total TradeHistory records imported: {count}")
        
        # Check for NaN symbols
        nan_symbols = session.query(TradeHistory).filter(TradeHistory.symbol == 'nan').count()
        print(f"Records with 'nan' symbol: {nan_symbols}")
        
        if count > 0 and nan_symbols == 0:
            print("SUCCESS: Import basic verification passed.")
            
            # Show sample
            sample = session.query(TradeHistory).limit(5).all()
            for s in sample:
                print(f"Sample: {s.symbol} {s.trade_type} {s.quantity} @ {s.price} on {s.trade_date}")
        else:
             print("FAILURE: Validation failed.")


if __name__ == "__main__":
    test_import()
