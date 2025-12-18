import pandas as pd
import os

file_path = r"c:\Users\uchida\git\StockAnalysis\参考ファイル\IBD 50.xls"

try:
    print(f"Reading {file_path}...")
    df = pd.read_excel(file_path)
    print("\nScanning for header...")
    header_row_idx = -1
    for i, row in df.iterrows():
        # Check if 'Symbol' or 'Ticker' is in values (case insensitive)
        row_str = row.astype(str).str.lower().tolist()
        if any('symbol' in s for s in row_str) or any('ticker' in s for s in row_str):
            print(f"Found potential header at row {i}:")
            print(row.tolist())
            header_row_idx = i
            break
            
    if header_row_idx != -1:
        # Re-read with header
        df = pd.read_excel(file_path, header=header_row_idx + 1) # pandas read_excel header is 0-indexed relative to file start?
        # If we read first time with default (header=0), and the dataframe index i corresponds to file row i+1.
        # Wait, read_excel(header=0) makes row 0 the header.
        # df index 0 is row 1.
        # So if we found it at df index i, it is actually row i+1 in the data part + 1 for header?
        # Actually simplest is: `pd.read_excel(path, header=original_index_in_file)`
        # If we read with default, row 0 of file is header. 
        # So df index `i` is actually row `i+1` of the file (0-based) if header was taken? 
        # No, let's just use `header=None` to allow index to match row number exactly.
        pass
except Exception as e:
    print(f"Error: {e}")

# Re-run with header=None to get exact row indices
try:
    print("\nRe-reading with header=None to simplify index:")
    df_raw = pd.read_excel(file_path, header=None)
    for i, row in df_raw.iterrows():
        row_str = row.astype(str).str.lower().tolist()
        if 'symbol' in row_str or 'ticker' in row_str:
            print(f"Exact Header Row Index: {i}")
            print(row.tolist())
            break
except Exception as e:
    print(f"Error: {e}")
