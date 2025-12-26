import pandas as pd
import yfinance as yf
import lxml # Required for earnings_dates
import os
from datetime import date, timedelta, datetime
import logging

# Configuration
DATA_DIR = "../data/stocks"
os.makedirs(DATA_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StockService:
    def __init__(self):
        pass

    def get_stock_data_path(self, symbol, interval="1d"):
        return os.path.join(DATA_DIR, f"{symbol}_{interval}.parquet")

    def delete_cache(self, symbol):
        """Delete cached data files for the symbol"""
        try:
            # Delete for all common intervals
            intervals = ["1d", "1wk", "1mo"]
            for interval in intervals:
                path = self.get_stock_data_path(symbol, interval)
                if os.path.exists(path):
                    os.remove(path)
                    logger.info(f"Deleted cache: {path}")
        except Exception as e:
            logger.error(f"Error deleting cache for {symbol}: {e}")

    def get_stock_info(self, symbol):
        try:
            ticker_symbol = symbol
            if symbol.isdigit() and len(symbol) == 4:
                ticker_symbol = f"{symbol}.T"
            ticker = yf.Ticker(ticker_symbol)
            return ticker.info
        except Exception as e:
            logger.error(f"Error getting info for {symbol}: {e}")
            return None

    def fetch_fundamentals(self, symbol):
        """
        Fetch fundamental data: Market Cap, Earnings Dates.
        Returns dict with keys: market_cap, last_earnings_date, next_earnings_date
        """
        try:
            ticker_symbol = symbol
            if symbol.isdigit() and len(symbol) == 4:
                ticker_symbol = f"{symbol}.T"
            
            ticker = yf.Ticker(ticker_symbol)
            info = ticker.info
            
            # Market Cap
            market_cap = info.get('marketCap')
            
            # Earnings
            # yfinance often provides 'calendar' or 'earnings_dates'
            # 'calendar' returns a dict or dataframe with next earnings date
            next_earnings = None
            last_earnings = None
            
            # Earnings Data Fetching Optimization
            # Priority 1: Trusted Source (SecFilerRetriever) for Last Earnings
            # Priority 2: Fast Sources (calendar) for Next Earnings
            
            now = pd.Timestamp.now().normalize()
            today_str = now.strftime('%Y-%m-%d')
            
            # 1. Try SecFilerRetriever for Last Earnings Date (Most Accurate)
            # This fetches actual 10-K/10-Q filing dates from SEC EDGAR
            try:
                # Initialize locally to avoid global import issues if package missing
                try:
                    from sec_filer_retriever import SecFilerRetriever
                    retriever = SecFilerRetriever(user_agent_email="admin@example.com")
                    
                    # Fetch latest filing on or before today
                    filing_date_str = retriever.get_most_recent_filing(symbol, today_str)
                    if filing_date_str:
                        last_earnings = pd.to_datetime(filing_date_str).to_pydatetime()
                except ImportError:
                    logger.warning("sec_filer_retriever package not found. Falling back to yfinance.")
                    # Fallback to yfinance logic if package missing
                    sec = ticker.sec_filings
                    if sec:
                        target_types = {'10-K', '10-Q', '20-F', '6-K'}
                        sec_sorted = sorted(sec, key=lambda x: str(x.get('date', '')), reverse=True)
                        for s in sec_sorted:
                            ftype = s.get('type', '').upper()
                            fdate = s.get('date')
                            if ftype in target_types and fdate:
                                temp_date = None
                                if isinstance(fdate, str):
                                    try: temp_date = pd.to_datetime(fdate).to_pydatetime()
                                    except: pass
                                elif isinstance(fdate, (date, datetime)):
                                    temp_date = pd.to_datetime(fdate).to_pydatetime()
                                
                                if temp_date and temp_date <= now:
                                    last_earnings = temp_date
                                    break
            except Exception as e:
                logger.warning(f"Error fetching last earnings for {symbol}: {e}")

            # 2. Try Calendar for Next Earnings Date (Fast ~0.1s)
            try:
                # Reset next_earnings to allow fresh check
                next_earnings = None 
                
                calendar = ticker.calendar
                if isinstance(calendar, dict):
                    temp_next = None
                    if 'Earnings Date' in calendar:
                        dates = calendar['Earnings Date']
                        if dates and len(dates) > 0:
                            temp_next = dates[0]
                    elif 0 in calendar:
                         dates = calendar[0]
                         if dates and len(dates) > 0:
                            temp_next = dates[0]
                    
                    # Validation: Next Earnings must be STRICTLY >= Today
                    # If it's in the past, it's garbage data (old schedule)
                    if temp_next:
                         temp_next = pd.to_datetime(temp_next).to_pydatetime()
                         if temp_next >= now:
                             next_earnings = temp_next
            except Exception as e:
                logger.warning(f"Error fetching calendar for {symbol}: {e}")

            # 3. Fallback: earnings_dates (Slow) - Only if missing data
            # Strict logic: enforce Last <= Now and Next >= Now
            if not last_earnings or not next_earnings:
                try:
                    ed = ticker.earnings_dates
                    if ed is not None and not ed.empty:
                        ed = ed.sort_index(ascending=False)
                        if ed.index.tz is not None:
                            ed.index = ed.index.tz_localize(None)
                        
                        # Fill Next if missing AND satisfy >= Now
                        if not next_earnings:
                            future = ed.index[ed.index >= now]
                            if len(future) > 0:
                                next_earnings = future.min().to_pydatetime()
                        
                        # Fill Last if missing AND satisfy <= Now
                        if not last_earnings:
                            past = ed.index[ed.index <= now]
                            if len(past) > 0:
                                last_earnings = past.max().to_pydatetime()
                except Exception as e:
                     if not last_earnings or not next_earnings:
                        logger.warning(f"Error fetching earnings_dates fallback for {symbol}: {e}")

            # Fallback for Last Earnings (if earnings_dates failed) - Use info 'mostRecentQuarter' only as last resort?
            # User specifically said 'mostRecentQuarter' is fiscal end, not report date.
            # So if we don't have earnings_dates, maybe it's better to leave it None than wrong?
            # Or use it but accept it might be fiscal end.
            # Let's trust earnings_dates primarily. If that failed, we assume we can't get report date accurately.
            
            return {
                "market_cap": market_cap,
                "next_earnings_date": next_earnings,
                "last_earnings_date": last_earnings
            }
        except Exception as e:
            logger.error(f"Error fetching fundamentals for {symbol}: {e}")
            return {}

    def get_stock_data(self, symbol, period="2y", interval="1d", force_refresh=False):
        """
        Get stock data, using cache if available and up-to-date.
        Auto-detects splits by comparing latest price if cached.
        """
        # Weekly data needs longer period for meaningful chart
        if interval == '1wk' and period == '2y':
            period = '5y'

        file_path = self.get_stock_data_path(symbol, interval)
        today = date.today()
        
        # Load from cache first
        if not force_refresh and os.path.exists(file_path):
            try:
                df = pd.read_parquet(file_path)
                # Check if data is up to date (e.g. has yesterday's data)
                last_date = df.index.max().date()
                
                # Freshness check logic dependent on interval
                # For 1d: yesterday. For 1wk: last week?
                # Simple check: if within 3 days for daily, 10 days for weekly
                days_threshold = 10 if interval == '1wk' else 3
                
                if last_date >= today - timedelta(days=days_threshold):
                     # If weekly, apply manual correction to ensure latest data is full
                    if interval == '1wk':
                        df = self._correct_weekly_candle(symbol, df)
                    
                    df = self._add_technical_indicators(df)
                    return df
                
                pass 
            except Exception as e:
                logger.error(f"Error reading cache for {symbol}: {e}")
        
        # Fetch data
        logger.info(f"Fetching data for {symbol} (interval={interval})...")
        
        # Handle Japanese stocks (4 digits) -> Append .T
        ticker_symbol = symbol
        if symbol.isdigit() and len(symbol) == 4:
            ticker_symbol = f"{symbol}.T"
            
        try:
            # interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
            # threads=False is CRITICAL for ThreadPoolExecutor usage and to avoid shared state leakage
            df = yf.download(ticker_symbol, period=period, interval=interval, progress=False, auto_adjust=True, threads=False)
            
            # Manual Weekly Correction (try to build/append from daily)
            if interval == '1wk' and not df.empty:
                df = self._correct_weekly_candle(symbol, df)

            if df.empty:
                logger.warning(f"No data for {symbol}")
                return pd.DataFrame()

            # Fix: Extract specific ticker if MultiIndex (yfinance thread-safety/state issue fix)
            if isinstance(df.columns, pd.MultiIndex):
                # Try to identify which level is Ticker. auto_adjust=True usually makes Price the columns, but MultiIndex remains if multiple symbols
                # If 'Ticker' is in names, use it.
                if 'Ticker' in df.columns.names:
                    # Try to find our symbol
                    available_tickers = df.columns.get_level_values('Ticker').unique()
                    target = None
                    if ticker_symbol in available_tickers:
                        target = ticker_symbol
                    elif symbol in available_tickers:
                        target = symbol
                    elif  len(available_tickers) > 0:
                        # Fallback: Use the last one? Or first?
                        # If we have multiple, picking one at random is dangerous if it's the wrong stock.
                        # But typically the "wrong" ones are accumulated garbage. The "right" one should be there?
                        # If the right one is NOT there, failure.
                        target = available_tickers[0] 
                    
                    if target:
                        df = df.xs(target, level='Ticker', axis=1)
                    else:
                        logger.error(f"Requested {symbol} but got {available_tickers}")
                        return pd.DataFrame()
                elif df.columns.nlevels > 1:
                     # Fallback flattening
                     df.columns = df.columns.get_level_values(0)

            # Enrich with indicators
            df = self._add_technical_indicators(df)
            return df
        except Exception as e:
            logger.error(f"Error fetching data for {symbol}: {e}")
            return pd.DataFrame()

    def _add_technical_indicators(self, data):
        if data.empty: 
            return data
            
        # Ensure single level column if multi-index (yfinance new version behavior)
        if isinstance(data.columns, pd.MultiIndex):
            # Safe MultiIndex handling:
            if 'Ticker' in data.columns.names:
                 # If we are here, it means get_stock_data didn't clean it up? 
                 # Or we loaded from cache that was polluted?
                 # If we don't know the symbol, we can't safely select.
                 # Proceeding with naive drop might be safer than crashing if there's only one.
                 if len(data.columns.get_level_values('Ticker').unique()) == 1:
                     data.columns = data.columns.droplevel('Ticker')
                 else:
                     logger.warning("Cache data has multiple tickers in _add_technical_indicators! Cleaning naive.")
                     data.columns = data.columns.get_level_values(0)
            elif data.columns.nlevels > 1:
                 data.columns = data.columns.get_level_values(0)
        
        # Calculate MAs
        # Use proper column names (Title Case usually)
        # yf 0.2+ returns Capitalized (Open, High...)
        
        try:
            data['Close_MA5'] = data['Close'].rolling(window=5).mean()
            data['Close_MA20'] = data['Close'].rolling(window=20).mean()
            data['Close_MA50'] = data['Close'].rolling(window=50).mean()
            data['Close_MA200'] = data['Close'].rolling(window=200).mean()

            # Calculate Deviations ((Close - MA) / MA * 100)
            data['Deviation_MA5'] = ((data['Close'] - data['Close_MA5']) / data['Close_MA5']) * 100
            data['Deviation_MA20'] = ((data['Close'] - data['Close_MA20']) / data['Close_MA20']) * 100
            data['Deviation_MA50'] = ((data['Close'] - data['Close_MA50']) / data['Close_MA50']) * 100
            data['Deviation_MA200'] = ((data['Close'] - data['Close_MA200']) / data['Close_MA200']) * 100
            
            # Calculate Slopes (Daily Change of MA)
            # User Request: (Slope / Close) * 100 * 100 = (Slope / Close) * 10000
            cols = [('Close_MA5', 'Slope_MA5'), ('Close_MA20', 'Slope_MA20'), ('Close_MA50', 'Slope_MA50'), ('Close_MA200', 'Slope_MA200')]
            for ma_col, slope_col in cols:
                # diff / close * 10000
                data[slope_col] = ((data[ma_col] - data[ma_col].shift(1)) / data['Close']) * 10000

            if 'Volume' in data.columns:
                data['Volume_MA50'] = data['Volume'].rolling(window=50).mean()
                data['Volume_MA200'] = data['Volume'].rolling(window=200).mean()
        except KeyError as e:
            logger.error(f"Missing column for MA calc: {e}")
        
        data = data.round(2)
        data.fillna(0, inplace=True)
        return data

    def _correct_weekly_candle(self, symbol, df):
        """
        Manually correct or append the last weekly candle using recent daily data.
        If the last weekly candle is from a previous week, append a new row for the current week.
        If it matches the current week, update it with the latest daily aggregation.
        """
        try:
             # Handle Japanese stocks (4 digits) -> Append .T
            ticker_symbol = symbol
            if symbol.isdigit() and len(symbol) == 4:
                ticker_symbol = f"{symbol}.T"

            # Fetch 1 month to be safe
            df_daily = yf.download(ticker_symbol, period="1mo", interval="1d", progress=False, auto_adjust=True, threads=False)
            if not df_daily.empty:
                # Ensure standard columns level
                if isinstance(df_daily.columns, pd.MultiIndex):
                    if 'Ticker' in df_daily.columns.names and ticker_symbol in df_daily.columns.get_level_values('Ticker'):
                         df_daily = df_daily.xs(ticker_symbol, level='Ticker', axis=1)
                    else:
                         df_daily.columns = df_daily.columns.get_level_values(0)
                
                # Identify current week range based on today's date (or latest daily date)
                # We want to match against the *start* of the week for the weekly chart index
                latest_daily_date = df_daily.index[-1].date()
                curr_week_start = latest_daily_date - timedelta(days=latest_daily_date.weekday()) # Monday

                last_weekly_date = df.index[-1].date()
                # Ensure last_weekly_date is also normalized to Monday if it isn't (yfinance usually does)
                last_weekly_start = last_weekly_date - timedelta(days=last_weekly_date.weekday())
                
                # Get daily data for the "Current Week" (starting from curr_week_start)
                this_week_daily = df_daily[df_daily.index.date >= curr_week_start]
                
                if not this_week_daily.empty and len(this_week_daily) > 0:
                    # Aggregate
                    new_close = this_week_daily['Close'].iloc[-1]
                    new_volume = this_week_daily['Volume'].sum()

                    # Check if we need to UPDATE existing or APPEND new
                    if last_weekly_start == curr_week_start:
                        # Update existing
                        logger.info(f"Updating weekly candle for {symbol} ({last_weekly_date}): Close {new_close:.2f}")
                        df.iloc[-1, df.columns.get_loc('Open')] = new_open
                        df.iloc[-1, df.columns.get_loc('High')] = new_high
                        df.iloc[-1, df.columns.get_loc('Low')] = new_low
                        df.iloc[-1, df.columns.get_loc('Close')] = new_close
                        df.iloc[-1, df.columns.get_loc('Volume')] = new_volume
                    elif last_weekly_start < curr_week_start:
                        # Append new row
                        logger.info(f"Appending new weekly candle for {symbol} ({curr_week_start}): Close {new_close:.2f}")
                        # Create a new DataFrame for the single row
                        new_index = pd.to_datetime(curr_week_start).tz_localize(df.index.tz) # Match timezone
                        new_row = pd.DataFrame({
                            'Open': [new_open],
                            'High': [new_high],
                            'Low': [new_low],
                            'Close': [new_close],
                            'Volume': [new_volume]
                        }, index=[new_index])
                        
                        # Concat
                        df = pd.concat([df, new_row])

        except Exception as e:
            logger.error(f"Error correcting weekly candle for {symbol}: {e}")
            
        return df


    def calculate_performance_metrics(self, df):
        """
        Calculate performance metrics (1D, 5D, 20D, 50D, 200D changes) from DataFrame.
        Returns a dict.
        """
        metrics = {}
        if df.empty or len(df) < 2:
            return metrics
            
        try:
            current_price = df['Close'].iloc[-1]
            
            # Helper to get change
            def get_change(days):
                if len(df) <= days:
                    return None
                prev_price = df['Close'].iloc[-(days+1)]
                if prev_price == 0: return None
                return ((current_price - prev_price) / prev_price) * 100.0
                
            metrics['change_percentage_1d'] = get_change(1)
            metrics['change_percentage_5d'] = get_change(5)
            metrics['change_percentage_20d'] = get_change(20)
            metrics['change_percentage_50d'] = get_change(50)
            metrics['change_percentage_200d'] = get_change(200)
            
        except Exception as e:
            logger.error(f"Error calculating metrics: {e}")
            
        return metrics

stock_service = StockService()
