from investment_app.backend.services.importer import importer
from investment_app.backend.database import create_db_and_tables

# Init DB
create_db_and_tables()

file_path = r"c:\Users\uchida\git\StockAnalysis\参考ファイル\InvestmentList.xlsx"
print(f"Importing {file_path}...")
count = importer.import_finviz_ibd_files([file_path])
print(f"Imported {count} stocks.")
