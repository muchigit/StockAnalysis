import pandas as pd
import json
import os

file_path = r"c:\Users\uchida\git\StockAnalysis\参考ファイル\InvestmentList.xlsx"
result = {}

try:
    if os.path.exists(file_path):
        df = pd.read_excel(file_path, engine='openpyxl')
        result['columns'] = df.columns.tolist()
        # Convert head to dict
        result['head'] = df.head(3).to_dict(orient='records')
        # Check for NaN in head
        # Json dump can't handle NaN, replace with None
        result['head'] = [{k: (v if pd.notna(v) else None) for k, v in row.items()} for row in result['head']]
    else:
        result['error'] = 'File not found'
except Exception as e:
    result['error'] = str(e)

print(json.dumps(result, indent=2, ensure_ascii=False))
