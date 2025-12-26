import pandas as pd
import os
import csv
from datetime import datetime
from sqlmodel import Session, select
from ..database import engine, Stock, TradeHistory
from .stock_service import stock_service
from .signals import get_signal_functions

class Importer:
    def __init__(self):
        pass
        
    def log_debug(self, msg):
        print(msg)

    def import_finviz_ibd_files(self, file_paths: list[str]):
        """
        Import list of files (Finviz, IBD).
        Expected columns vary, but we need Symbol.
        """
        self.log_debug(f"Starting import for files: {file_paths}")
        total_imported = 0
        added_symbols = []
        with Session(engine) as session:
            for file_path in file_paths:
                try:
                    self.log_debug(f"Processing file: {file_path}")
                    # Determine loader based on extension
                    if file_path.endswith('.csv'):
                        df = pd.read_csv(file_path)
                    else:
                        # finviz export might be xls but actually html table? or actual xls.
                        # Using pandas read_excel for xls/xlsx
                        try:
                            # Read header scan
                            df_raw = pd.read_excel(file_path, header=None, nrows=20)
                            header_idx = -1
                            self.log_debug("Scanning for header row...")
                            for i, row in df_raw.iterrows():
                                row_str = [str(val).strip().lower() for val in row.values]
                                # Strict match for header columns to avoid matching Description text
                                if any(x in row_str for x in ['symbol', 'ticker', 'company symbol', 'code', '銘柄コード', 'ティッカー', 'stock symbol', 'ticker symbol']):
                                    header_idx = i
                                    self.log_debug(f"Header found at alias match row {i}: {row_str}")
                                    break
                            
                            if header_idx != -1:
                                self.log_debug(f"Found header at index {header_idx}")
                                # Re-read full file with correct header
                                df = pd.read_excel(file_path, header=header_idx)
                            else:
                                self.log_debug("No header row found by scan, using default.")
                                df = pd.read_excel(file_path) # Fallback to default
                                
                        except Exception as e:
                            self.log_debug(f"Excel read error: {e}")
                            # Sometimes they are CSVs named xls?
                            df = pd.read_csv(file_path, sep='\t') # Try tab?
                            
                    # Normalize columns
                    # Strip whitespace from all column names to ensure exact matching works
                    df.columns = [str(c).strip() for c in df.columns]
                    
                    # We look for 'Symbol', 'Ticker', 'Company Symbol'
                    symbol_col = None
                    self.log_debug(f"Columns found: {df.columns.tolist()}")
                    for col in df.columns:
                        c_lower = str(col).lower().strip()
                        self.log_debug(f"[Import] Checking col: '{col}' -> '{c_lower}'")
                        if c_lower in ['symbol', 'ticker', 'company symbol', 'code', '銘柄コード', 'ティッカー', 'stock symbol', 'ticker symbol']:
                            symbol_col = col
                            self.log_debug(f"[Import] Match found: {symbol_col}")
                            break

                    
                    if not symbol_col:
                        print(f"Skipping {file_path}: No Symbol column found.")
                        continue
                        
                    # Process tickers
                    for _, row in df.iterrows():
                        # Debug first row to see headers/keys
                        if total_imported == 0:
                            print(f"[Import Debug] First row keys: {list(row.keys())}")
                            print(f"[Import Debug] First row values: {row.values}")

                        symbol = str(row[symbol_col]).strip()
                        if not symbol or symbol == 'nan': continue
                        
                        # Filter out known footer lines
                        if "Data provided by" in symbol or "Rights Reserved" in symbol or len(symbol) > 15:
                            continue

                        # Check Skip column
                        skip_val = None
                        if 'Skip' in row: skip_val = row['Skip']
                        elif 'skip' in row: skip_val = row['skip']
                        
                        if skip_val and str(skip_val).strip().upper() == 'X':
                            continue
                        
                        # Upsert Stock
                        stock = session.get(Stock, symbol)
                        is_new_stock = False
                        if not stock:
                            stock = Stock(symbol=symbol)
                            stock.first_import_date = datetime.utcnow()
                            session.add(stock)
                            is_new_stock = True
                            added_symbols.append(symbol)
                        else:
                            # Backfill if missing (optional, but good for existing imports if re-run)
                            if not stock.first_import_date:
                                stock.first_import_date = datetime.utcnow()
                            
                        # Update other fields if available
                        if 'Company' in row: stock.company_name = row['Company']
                        if 'Company Name' in row: stock.company_name = row['Company Name']
                        if '銘柄名' in row: stock.company_name = row['銘柄名']
                        if 'Sector' in row: stock.sector = row['Sector']
                        if 'Industry' in row: stock.industry = row['Industry']
                        
                        # IBD Ratings Import
                        # Parse Composite Rating
                        for col_name in ['Composite Rating', 'Comp Rating']:
                            if col_name in row and pd.notna(row[col_name]):
                                try:
                                    stock.composite_rating = int(float(str(row[col_name]).strip()))
                                except: pass
                                
                        # Parse RS Rating
                        for col_name in ['RS Rating', 'Relative Strength Rating']:
                            if col_name in row and pd.notna(row[col_name]):
                                try:
                                    stock.rs_rating = int(float(str(row[col_name]).strip()))
                                except: pass
                                
                        # Parse IBD Date from various columns
                        # "IBD50", "New High", "RS New High", "My Stock"
                        found_date = None
                        for date_col in ['IBD50', 'New High', 'RS New High', 'My Stock']:
                            if date_col in row and pd.notna(row[date_col]):
                                val = row[date_col]
                                # If it's a datetime object (pandas often parses excel dates automatically)
                                if isinstance(val, (datetime, pd.Timestamp)):
                                    found_date = val
                                    break
                                # If string, try parse
                                elif isinstance(val, str) and val.strip():
                                    try:
                                        # Use pandas to parse flexibly (handles YYYY-MM-DD etc)
                                        dt = pd.to_datetime(val)
                                        if pd.notna(dt):
                                            found_date = dt
                                            break
                                    except Exception as e:
                                        print(f"[Import] Date parse error for {symbol} col {date_col} val '{val}': {e}")
                                else:
                                    # Fallback for unexpected types
                                    print(f"[Import] Unhandled date type for {symbol} col {date_col}: {type(val)} val {val}")
                                    try:
                                        dt = pd.to_datetime(val)
                                        if pd.notna(dt):
                                            found_date = dt
                                            print(f"[Import] Fallback parse success: {dt}")
                                            break
                                    except: pass
                        
                        if found_date:
                            print(f"[Import] Found date for {symbol}: {found_date}")
                            stock.ibd_rating_date = found_date
                            if not is_new_stock and stock not in session.new:
                                session.add(stock)

                        # Market Cap
                        # Aliases: 'Market Cap', '時価総額'
                        mcap_val = None
                        if 'Market Cap' in row and pd.notna(row['Market Cap']):
                            mcap_val = row['Market Cap']
                        elif '時価総額' in row and pd.notna(row['時価総額']):
                            mcap_val = row['時価総額']
                            
                        if mcap_val:
                            val = str(mcap_val).strip().upper()
                            try:
                                if val.endswith('B'):
                                    stock.market_cap = float(val.replace('B', '')) * 1e9
                                elif val.endswith('M'):
                                    stock.market_cap = float(val.replace('M', '')) * 1e6
                                elif val.endswith('K'):
                                    stock.market_cap = float(val.replace('K', '')) * 1e3
                                else:
                                    stock.market_cap = float(val)
                            except:
                                pass # Keep None if parse fails
                        
                        # --- New Fields Import ---
                        # Volume
                        # Volume
                        # Aliases: 'Volume', '出来高'
                        vol_val = None
                        if 'Volume' in row and pd.notna(row['Volume']):
                            vol_val = row['Volume']
                        elif '出来高' in row and pd.notna(row['出来高']):
                            vol_val = row['出来高']
                            
                        if vol_val:
                            val = str(vol_val).strip().replace(',', '')
                            try:
                                stock.volume = float(val)
                            except: 
                                print(f"[Import Debug] Failed to parse volume: {val}")
                        else:
                             # Only print sometimes to avoid spam
                             if total_imported < 5:
                                 print(f"[Import Debug] Volume not found for {symbol}. Keys checked: Volume, 出来高. Row keys present: {[k for k in row.keys() if 'Volume' in str(k) or '出来' in str(k)]}")
                            
                        # Volume % Change
                        # Aliases: 'Volume % Change', 'Vol % Change', '出来高増加率'
                        for v_col in ['Volume % Change', 'Vol % Change', '出来高増加率']:
                            if v_col in row and pd.notna(row[v_col]):
                                val = str(row[v_col]).strip().replace('%', '')
                                try:
                                    stock.volume_increase_pct = float(val)
                                except: pass
                        
                        # Earnings Dates
                        # Aliases: 'Earnings Date', 'Next Earnings Date', '次回決算日' -> next_earnings_date
                        # Aliases: 'Last Earnings', '直近決算日' -> last_earnings_date
                        
                        def parse_dt(v):
                            if isinstance(v, (datetime, pd.Timestamp)): return v
                            try: return pd.to_datetime(v)
                            except: return None

                        for col in ['Next Earnings Date', 'Earnings Date', '次回決算日']:
                            if col in row and pd.notna(row[col]):
                                dt = parse_dt(row[col])
                                if dt: stock.next_earnings_date = dt
                                
                        for col in ['Last Earnings', '直近決算日']:
                            if col in row and pd.notna(row[col]):
                                dt = parse_dt(row[col])
                                if dt: stock.last_earnings_date = dt
                                
                        stock.updated_at = datetime.utcnow()
                        total_imported += 1
                except Exception as e:
                    print(f"Error processing file {file_path}: {e}")
                        
            session.commit()
        return {'count': total_imported, 'added': added_symbols}

    def import_moomoo_csv(self, file_path: str):
        """
        Import Moomoo trade history CSV.
        """
        # "売買方向","銘柄コード","銘柄名","価格","数量","約定日時"
        
        imported_count = 0
        with Session(engine) as session:
            # Encoding check - Japanese Windows CSV often Shift-JIS
            try:
                df = pd.read_csv(file_path, encoding='shift_jis')
            except:
                df = pd.read_csv(file_path, encoding='utf-8')
            
            # Identify columns (Loose matching)
            col_map = {}
            for col in df.columns:
                if "銘柄コード" in col: col_map['symbol'] = col
                if "売買方向" in col: col_map['side'] = col # '買い' or '売り'
                if "価格" in col and "取得" not in col: col_map['price'] = col # Avoid "取得価格" if pure "価格" exists? Check sample. Sample had just "価格".
                if "数量" in col: col_map['qty'] = col
                if "合計" in col: col_map['total'] = col
                # Date format: "2025/12/11 23:58:12 ET"
                # Need to find date column. The sample had empty header for many cols in the snippet? 
                # Step 90 Output:
                # "売り","EZPW",..."2025/12/12 11:36:47 ET"...
                # Step 97 Output: "売買方向","銘柄コード","銘柄名","価格","数量", ... ,"取引手数料",
                # Wait, where is the Date column in header?
                # The sample in Step 90 row: "売り","EZPW","イージーコープ A","トリガー成行","180","0.00","注文予約中","0","2025/12/12 11:36:47 ET"...
                # It seems Date is the 9th column (index 8).
                # Let's verify Step 97 header again.
                # "売買方向"(0),"銘柄コード"(1),"銘柄名"(2),"価格"(3),"数量"(4)...
                # It seems I need to be careful. I will use index-based if column names fail, but column names are safer if I can read them.
                
                # Let's assume standard names for now based on user description.
                # If "約定日時" or "取引時間" exists.
            
            # Re-reading header: "売買方向","銘柄コード","銘柄名","価格","数量", ...
            # I'll rely on explicit names found in `df.columns`.
            
            # Pre-process: Moomoo CSV often has "child rows" for partial fills where Symbol/Side are empty.
            # We need to forward-fill these values from the parent row.
            symbol_col = col_map.get('symbol', '銘柄コード')
            side_col = col_map.get('side', '売買方向')
            
            if symbol_col in df.columns:
                df[symbol_col] = df[symbol_col].ffill()
            if side_col in df.columns:
                df[side_col] = df[side_col].ffill()

            for _, row in df.iterrows():
                try:
                    # Symbol
                    symbol = row.get(symbol_col)
                    if pd.isna(symbol) or str(symbol).strip() == '' or str(symbol) == 'nan':
                         continue
                    symbol = str(symbol).strip()
                    
                    # Side
                    side = row.get(side_col) # "売り" / "買い"
                    
                    # Qty
                    qty = row.get(col_map.get('qty', '数量'))
                    
                    # Validation: Moomoo export might include orders that are not executed or have missing data
                    # Check for valid Qty and Price first
                    if pd.isna(qty) or str(qty).strip() == '':
                        print(f"Skipping row due to missing qty: {symbol}")
                        continue

                    try:
                        qty = float(str(qty).replace(',', ''))
                    except ValueError:
                        continue # Skip if qty is not a number

                    price = row.get(col_map.get('price', '価格'))
                    if pd.isna(price) or str(price).strip() == '':
                         # Sometimes price is missing but it's not a trade?
                         print(f"Skipping row due to missing price: {symbol}")
                         continue
                        
                    try:
                        price = float(str(price).replace(',', ''))
                    except ValueError:
                         continue

                    # Date parsing (Restored)
                    trade_date_str = None
                    # Search for date in potential columns if header is messy or "約定日時" exists
                    # First check known map
                    if '約定日時' in df.columns:
                        trade_date_str = str(row['約定日時'])
                    
                    if not trade_date_str or trade_date_str == 'nan':
                        # Fallback: look for ET string in row values
                        for col in df.columns:
                            val = str(row[col])
                            if 'ET' in val and '/' in val:
                                trade_date_str = val
                                break
                    
                    trade_date = datetime.utcnow()
                    if trade_date_str and trade_date_str != 'nan':
                        clean_date = trade_date_str.replace(' ET', '').replace(' JST', '') # Handle JST too if present
                        try:
                            # Try common formats
                            # 2025/12/12 11:36:47
                            trade_date = datetime.strptime(clean_date, "%Y/%m/%d %H:%M:%S")
                        except:
                            try:
                                trade_date = datetime.strptime(clean_date, "%Y-%m-%d %H:%M:%S")
                            except:
                                pass # Keep default utcnow if parsing fails

                    # Check for duplicates
                    # We assume duplicate if Symbol, Side, Qty, Price, Date match exactly.
                    existing_trade = session.exec(select(TradeHistory).where(
                        TradeHistory.symbol == symbol,
                        TradeHistory.trade_type == side,
                        TradeHistory.quantity == qty,
                        TradeHistory.price == price,
                        TradeHistory.trade_date == trade_date
                    )).first()

                    if existing_trade:
                        print(f"Skipping duplicate trade: {symbol} {side} {qty} @ {price} on {trade_date}")
                        continue

                    # Save to DB
                    trade = TradeHistory(
                        symbol=symbol,
                        trade_type=side,
                        quantity=qty,
                        price=price,
                        trade_date=trade_date
                    )
                    session.add(trade)
                    imported_count += 1
                except Exception as e:
                    print(f"Error importing row: {e}")
                    continue
            
            session.commit()
        return imported_count

importer = Importer()
