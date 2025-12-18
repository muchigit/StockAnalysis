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
                self.last_completed = datetime.now(JST).isoformat()
                
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

                         stock.updated_at = datetime.utcnow()
                         session.add(stock)
                         
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
