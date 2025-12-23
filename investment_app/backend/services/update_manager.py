import time
import threading
import traceback
from datetime import datetime, timedelta
import pytz
from sqlmodel import Session, select
from ..database import engine, Stock
from ..services.stock_service import stock_service
from ..services.signals import get_signal_functions
import pandas as pd

JST = pytz.timezone('Asia/Tokyo')

class UpdateManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(UpdateManager, cls).__new__(cls)
            cls._instance.status = "idle" # idle, running, waiting_retry, completed
            cls._instance.message = ""
            cls._instance.progress = 0
            cls._instance.total = 0
            try:
                with Session(engine) as session:
                    # Fallback: Get latest updated_at from DB
                    from sqlalchemy import func
                    latest = session.exec(select(func.max(Stock.updated_at))).first()
                    # latest is datetime or None.
                    # Convert to ISO format if exists.
                    if latest:
                        # Assuming stored as naive UTC (updated_at = datetime.utcnow())
                        # We append 'Z' to indicate UTC to the frontend.
                        # If it already had timezone info, isoformat() would include it.
                        iso = latest.isoformat()
                        if latest.tzinfo is None:
                            iso += 'Z'
                        cls._instance.last_completed = iso
                    else:
                        cls._instance.last_completed = None
            except Exception:
                cls._instance.last_completed = None
                
            cls._instance.is_stop_requested = False
            cls._instance.thread = None
        return cls._instance

    def get_status(self):
        return {
            "status": self.status,
            "message": self.message,
            "progress": self.progress,
            "total": self.total,
            "last_completed": self.last_completed
        }

    def start_update(self):
        if self.status in ["running", "waiting_retry"]:
            return False
        
        self.is_stop_requested = False
        self.thread = threading.Thread(target=self._run_loop)
        self.thread.start()
        return True
        
    def _run_loop(self):
        self.status = "running"
        self.message = "Initializing update..."
        self.progress = 0
        
        try:
            with Session(engine) as session:
                stocks = session.exec(select(Stock)).all()
                self.total = len(stocks)
            
            # Identify stocks to update (Simple logic: just update all for now as requested "All stocks update logic")
            # Or we could filter by date. User requested "Update all mechanism".
            
            error_stocks = []
            
            # 1. Update Loop
            self._process_stocks(stocks, error_stocks)
            
            # 2. Retry Loop
            while error_stocks and not self.is_stop_requested:
                self.status = "waiting_retry"
                self.message = f"Errors in {len(error_stocks)} stocks. Retrying in 10 minutes..."
                
                # Wait 10 mins (check stop every second)
                for _ in range(600): 
                    if self.is_stop_requested: break
                    time.sleep(1)
                
                if self.is_stop_requested: break
                
                self.status = "running"
                self.message = f"Retrying {len(error_stocks)} stocks..."
                
                # Retry
                retry_targets = error_stocks[:] # copy
                error_stocks = [] # reset
                
                # Re-fetch objects to ensure session valid? 
                # Better to just use symbols and fetch fresh in _process_stocks if we passed objects.
                # Actually, passing objects across sessions is risky. Let's pass symbols.
                
                # But to avoid refactoring helper, let's just pass the list.
                # Note: `_process_stocks` handles session creation.
                self._process_stocks(retry_targets, error_stocks)
                
            if not self.is_stop_requested:
                self.status = "completed"
                self.message = "All updates completed."
                # Use UTC to match DB fallback logic
                self.last_completed = datetime.utcnow().isoformat() + 'Z'
                
        except Exception as e:
            self.status = "error"
            self.message = f"System error: {str(e)}"
            traceback.print_exc()
            
    def _process_stocks(self, stocks, error_list):
        count = 0 
        total_batch = len(stocks)
        
        # We need fresh session for updates
        with Session(engine) as session:
             # If stocks are objects from another session, we re-fetch or merge?
             # If we passed list of Stock objects, they might be detached.
             # Safest is to extract symbols and re-fetch.
             symbols=[s.symbol if isinstance(s, Stock) else s for s in stocks]

             # --- PRE-FETCH SP500 FOR RS CALCULATION ---
             sp500_changes = {}
             try:
                 print("Fetching ^GSPC for RS comparison...")
                 sp500_df = stock_service.get_stock_data('^GSPC', period='2y', interval='1d', force_refresh=True)
                 if not sp500_df.empty:
                     sp500_close = sp500_df['Close']
                     sp500_curr = sp500_close.iloc[-1]
                     
                     def calc_sp_change(days):
                        if len(sp500_close) > days:
                            idx = -(days + 1)
                            if abs(idx) <= len(sp500_close):
                                prev = sp500_close.iloc[idx]
                                if prev != 0: return ((sp500_curr - prev) / prev) * 100.0
                        return None
                        
                     sp500_changes[5] = calc_sp_change(5)
                     sp500_changes[20] = calc_sp_change(20)
                     sp500_changes[50] = calc_sp_change(50)
                     sp500_changes[200] = calc_sp_change(200)
             except Exception as e:
                 print(f"Failed to fetch SP500: {e}")
             # ------------------------------------------
             
             # Process in chunks to commit periodically
             chunk_size = 50
             for i in range(0, len(symbols), chunk_size):
                 if self.is_stop_requested: break
                 
                 chunk = symbols[i:i+chunk_size]
                 
                 for sym in chunk:
                     if self.is_stop_requested: break
                     try:
                         self.message = f"Updating {sym} ({self.progress + 1}/{self.total})..."
                         
                         stock = session.get(Stock, sym)
                         if not stock: continue
                         
                         # Data Fetch & Update Logic (From update_price_stats.py)
                         # Use force_refresh=True to ensure we get latest if it's 9:30
                         df = stock_service.get_stock_data(stock.symbol, period='2y', interval='1d', force_refresh=True)
                         
                         if df.empty or len(df) < 5:
                            if df.empty: raise Exception("Empty data")
                         
                         # --- Fundamentals (Market Cap, Earnings) ---
                         # Run this less frequently? Or every time? User requested "Update" so let's do it.
                         try:
                             print(f"[DEBUG] Fetching fundamentals for {sym}...")
                             funds = stock_service.fetch_fundamentals(stock.symbol)
                             if funds.get('market_cap'):
                                 stock.market_cap = funds['market_cap']
                                 print(f"[DEBUG] {sym} Market Cap: {stock.market_cap}")
                             if funds.get('next_earnings_date'):
                                 stock.next_earnings_date = funds['next_earnings_date']
                             if funds.get('last_earnings_date'):
                                 stock.last_earnings_date = funds['last_earnings_date']
                         except Exception as e:
                             print(f"Fundamentals fetch failed for {sym}: {e}")

                         # --- Volume & Volume % ---
                         try:
                             print(f"[DEBUG] Calculating volume for {sym}...")
                             # Find last row with valid Volume
                             # df['Volume'] might have NaNs (e.g. today's incomplete data)
                             # We want the last actual trading volume.
                             valid_vol_mask = df['Volume'].notna() & (df['Volume'] > 0)
                             if valid_vol_mask.any():
                                 current_volume = df.loc[valid_vol_mask, 'Volume'].iloc[-1]
                                 stock.volume = float(current_volume)
                                 print(f"[DEBUG] {sym} Volume: {stock.volume}")
                                 
                                 # For increase %, compare with the volume BEFORE the last valid one
                                 # We need the index of the last valid volume
                                 last_valid_idx = df.index[valid_vol_mask][-1]
                                 # Get position integer
                                 pos = df.index.get_loc(last_valid_idx)
                                 
                                 if pos > 0:
                                     # Previous volume is the one at pos-1? 
                                     # Need to check if THAT one is valid? 
                                     # Usually yes, but let's just take the row before.
                                     # If there are gaps, we might want the last valid before that.
                                     # Simplification: use shift on masked series?
                                     valid_series = df.loc[valid_vol_mask, 'Volume']
                                     if len(valid_series) >= 2:
                                         prev_volume = valid_series.iloc[-2]
                                         if prev_volume > 0:
                                             stock.volume_increase_pct = ((current_volume - prev_volume) / prev_volume) * 100.0
                                         else:
                                             stock.volume_increase_pct = 0.0
                                     else:
                                         stock.volume_increase_pct = 0.0
                                 else:
                                     stock.volume_increase_pct = 0.0
                             else:
                                 # No valid volume in entire history??
                                 stock.volume = None
                                 stock.volume_increase_pct = None

                         except Exception as e:
                             print(f"Volume calc failed for {sym}: {e}")
                             
                         # Metadata Backfill (Sector/Industry)
                         
                         # Metadata Backfill (Sector/Industry)
                         if not stock.sector or not stock.industry:
                             try:
                                 info = stock_service.get_stock_info(stock.symbol)
                                 if info:
                                     if not stock.sector: stock.sector = info.get('sector')
                                     if not stock.industry: stock.industry = info.get('industry')
                                     # Optional: Backfill company name if missing
                                     if not stock.company_name:
                                         stock.company_name = info.get('longName') or info.get('shortName')
                             except Exception as e:
                                 print(f"Metadata fetch failed for {sym}: {e}")

                         close = df['Close']
                         current_price = close.iloc[-1]
                         
                         # --- Chart Data Population ---
                         # Extract last 40 days for mini chart
                         # Columns needed: Open, High, Low, Close, Volume
                         try:
                             if not df.empty:
                                 # Calculate SMAs for the whole df first
                                 df['SMA5'] = df['Close'].rolling(window=5).mean()
                                 df['SMA20'] = df['Close'].rolling(window=20).mean()
                                 df['SMA50'] = df['Close'].rolling(window=50).mean()
                                 df['SMA100'] = df['Close'].rolling(window=100).mean()
                                 df['SMA200'] = df['Close'].rolling(window=200).mean()

                                 chart_df = df.tail(40).copy()
                                 
                                 chart_data = []
                                 for dt, row in chart_df.iterrows():
                                     chart_data.append({
                                         "d": dt.strftime('%Y-%m-%d'),
                                         "o": float(row['Open']),
                                         "h": float(row['High']),
                                         "l": float(row['Low']),
                                         "c": float(row['Close']),
                                         "v": int(row['Volume']),
                                         "sap": [ # SMAs Array
                                             float(row['SMA5']) if pd.notna(row['SMA5']) else None,
                                             float(row['SMA20']) if pd.notna(row['SMA20']) else None,
                                             float(row['SMA50']) if pd.notna(row['SMA50']) else None,
                                             float(row['SMA200']) if pd.notna(row['SMA200']) else None,
                                             float(row['SMA100']) if pd.notna(row['SMA100']) else None
                                         ]
                                     })
                                 import json
                                 stock.daily_chart_data = json.dumps(chart_data)
                         except Exception as e:
                             print(f"Chart data error {sym}: {e}")
                         # -----------------------------
                         
                         # Calcs
                         def calc_change(days):
                            if len(close) > days:
                                idx = -(days + 1)
                                if abs(idx) <= len(close):
                                    prev = close.iloc[idx]
                                    if prev != 0: return ((current_price - prev) / prev) * 100.0
                            return None

                         stock.change_percentage_1d = calc_change(1)
                         stock.change_percentage_5d = calc_change(5)
                         stock.change_percentage_20d = calc_change(20)
                         stock.change_percentage_50d = calc_change(50)
                         stock.change_percentage_200d = calc_change(200)

                         # Save Current Price
                         stock.current_price = float(current_price)
                         
                         # Calculate RS (Stock Change - SP500 Change)
                         if stock.change_percentage_5d is not None and sp500_changes.get(5) is not None:
                             stock.rs_5d = stock.change_percentage_5d - sp500_changes[5]
                         if stock.change_percentage_20d is not None and sp500_changes.get(20) is not None:
                             stock.rs_20d = stock.change_percentage_20d - sp500_changes[20]
                         if stock.change_percentage_50d is not None and sp500_changes.get(50) is not None:
                             stock.rs_50d = stock.change_percentage_50d - sp500_changes[50]
                         if stock.change_percentage_200d is not None and sp500_changes.get(200) is not None:
                             stock.rs_200d = stock.change_percentage_200d - sp500_changes[200]
                         
                         # ATR
                         try:
                            high = df['High']
                            low = df['Low']
                            prev_close = close.shift(1)
                            tr1 = high - low
                            tr2 = (high - prev_close).abs()
                            tr3 = (low - prev_close).abs()
                            tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
                            atr = tr.rolling(window=14).mean()
                            if len(atr) > 0 and pd.notna(atr.iloc[-1]):
                                stock.atr_14 = float(atr.iloc[-1])
                         except: pass

                         # Signals
                         try:
                            sig_funcs = get_signal_functions()
                            for name, func in sig_funcs.items():
                                val = func(df)
                                setattr(stock, f"signal_{name}", int(val))
                         except: pass
                         # Store Deviations
                         try:
                             if 'Deviation_MA5' in df.columns and pd.notna(df['Deviation_MA5'].iloc[-1]):
                                 stock.deviation_5ma_pct = float(df['Deviation_MA5'].iloc[-1])
                             if 'Deviation_MA20' in df.columns and pd.notna(df['Deviation_MA20'].iloc[-1]):
                                 stock.deviation_20ma_pct = float(df['Deviation_MA20'].iloc[-1])
                             if 'Deviation_MA50' in df.columns and pd.notna(df['Deviation_MA50'].iloc[-1]):
                                 stock.deviation_50ma_pct = float(df['Deviation_MA50'].iloc[-1])
                             if 'Deviation_MA200' in df.columns and pd.notna(df['Deviation_MA200'].iloc[-1]):
                                 stock.deviation_200ma_pct = float(df['Deviation_MA200'].iloc[-1])
                         except Exception as e:
                             print(f"Deviation save error {sym}: {e}")

                         # Store Slopes
                         try:
                             if 'Slope_MA5' in df.columns and pd.notna(df['Slope_MA5'].iloc[-1]):
                                 stock.slope_5ma = float(df['Slope_MA5'].iloc[-1])
                             if 'Slope_MA20' in df.columns and pd.notna(df['Slope_MA20'].iloc[-1]):
                                 stock.slope_20ma = float(df['Slope_MA20'].iloc[-1])
                             if 'Slope_MA50' in df.columns and pd.notna(df['Slope_MA50'].iloc[-1]):
                                 stock.slope_50ma = float(df['Slope_MA50'].iloc[-1])
                             if 'Slope_MA200' in df.columns and pd.notna(df['Slope_MA200'].iloc[-1]):
                                 stock.slope_200ma = float(df['Slope_MA200'].iloc[-1])
                         except Exception as e:
                             print(f"Slope save error {sym}: {e}")

                         stock.updated_at = datetime.utcnow()
                         session.add(stock)
                         
                         # Add delay to prevent rate limiting (yfinance is sensitive)
                         time.sleep(2)
                         
                         self.progress += 1
                         
                     except Exception as e:
                         print(f"Error updating {sym}: {e}")
                         # Add to error list for retry
                         if sym not in error_list:
                             error_list.append(sym)
                 
                 session.commit()
                 
    def stop(self):
        self.is_stop_requested = True

update_manager = UpdateManager()
