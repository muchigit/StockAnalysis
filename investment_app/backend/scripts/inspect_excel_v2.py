import pandas as pd
import os
import sys

# Force stdout to flush
sys.stdout.reconfigure(encoding='utf-8')

file_path = r"c:\Users\uchida\git\StockAnalysis\参考ファイル\InvestmentList.xlsx"

print(f"Inspecting: {file_path}")

try:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        exit(1)

    df = pd.read_excel(file_path, engine='openpyxl')
    print("--- Columns ---")
    print(df.columns.tolist())
    print("--- First Rows ---")
    print(df.head(3).to_string())
except Exception as e:
    print(f"Error: {e}")
