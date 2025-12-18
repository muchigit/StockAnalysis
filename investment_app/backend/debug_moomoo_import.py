import pandas as pd
import sys
import os

file_path = r"c:\Users\uchida\git\StockAnalysis\参考ファイル\履歴-現物口座(7335)-20251213-143800.csv"

with open("debug_log.txt", "w", encoding="utf-8") as f:
    f.write(f"Reading {file_path}\n")
    try:
        # Try different encodings
        try:
            df = pd.read_csv(file_path, encoding='shift_jis')
            f.write("Read with Shift-JIS\n")
        except:
            df = pd.read_csv(file_path, encoding='utf-8')
            f.write("Read with UTF-8\n")

        f.write("\nColumns:\n")
        f.write(str(df.columns.tolist()) + "\n")
        
        f.write("\nFirst 10 rows:\n")
        f.write(df.head(10).to_string() + "\n")

        f.write("\nTesting Row Parsing:\n")
        col_map = {}
        for col in df.columns:
            if "銘柄コード" in col: col_map['symbol'] = col
            if "売買方向" in col: col_map['side'] = col
            if "価格" in col and "取得" not in col: col_map['price'] = col
            if "数量" in col: col_map['qty'] = col
            if "約定日時" in col: col_map['date'] = col

        f.write(f"Col Map: {col_map}\n")

        for i, row in df.iterrows():
            symbol = row.get(col_map.get('symbol', '銘柄コード'))
            qty = row.get(col_map.get('qty', '数量'))
            price = row.get(col_map.get('price', '価格'))
            date_val = row.get(col_map.get('date', '約定日時'))
            
            # Check date in all columns if not found
            date_found_in_cols = None
            for col in df.columns:
                 val = str(row[col])
                 if 'ET' in val and '/' in val:
                     date_found_in_cols = val
                     break

            f.write(f"Row {i}: Sym={symbol}, Qty={qty}, Price={price}, Date={date_val} (Scan={date_found_in_cols})\n")
    
    except Exception as e:
        f.write(f"Error: {e}\n")
