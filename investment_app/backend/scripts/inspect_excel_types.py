import pandas as pd

file_path = r'c:\Users\uchida\git\StockAnalysis\参考ファイル\InvestmentList.xlsx'

try:
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    
    date_cols = ['IBD50', 'New High', 'RS New High', 'My Stock']
    for col in date_cols:
        if col in df.columns:
            first_valid = df[col].dropna().iloc[0] if not df[col].dropna().empty else "Empty"
            print(f"Column '{col}': Type of first value: {type(first_valid)}, Value: {first_valid}")
        else:
            print(f"Column '{col}' not found")
except Exception as e:
    print(f"Error: {e}")
