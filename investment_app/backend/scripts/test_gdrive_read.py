import os
import re

TARGET_DIR = r"G:\マイドライブ\分析レポート 買い リネーム済み"

def scan_gdrive_files():
    if not os.path.exists(TARGET_DIR):
        print(f"Directory not found: {TARGET_DIR}")
        return

    files = os.listdir(TARGET_DIR)
    print(f"Found {len(files)} files.")

    # Regex to capture: Description/Name, Ticker, Date
    # Pattern: Everything... [TICKER] (DATE) .gdoc...
    pattern = re.compile(r"^(.*?)\[([A-Za-z0-9\.-]+)\]\(([\d-]+)\)")

    count = 0
    for file in files:
        match = pattern.search(file)
        if match:
            desc_and_company = match.group(1).strip()
            ticker = match.group(2).strip()
            date_str = match.group(3).strip()
            
            print(f"Matched: {ticker} | Date: {date_str} | Desc: {desc_and_company}")
            count += 1
            if count >= 10: break
        else:
            # print(f"No match: {file}")
            pass

if __name__ == "__main__":
    scan_gdrive_files()
