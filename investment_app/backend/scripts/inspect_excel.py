import pandas as pd
import os

file_path = r"c:\Users\uchida\git\StockAnalysis\参考ファイル\InvestmentList.xlsx"

try:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        exit(1)

    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    print("First 3 rows:")
    print(df.head(3).to_string())
except Exception as e:
    print(f"Error reading excel: {e}")
