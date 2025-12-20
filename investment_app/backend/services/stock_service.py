import pandas as pd
import yfinance as yf
import os
from datetime import date, timedelta
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
            df = yf.download(ticker_symbol, period=period, interval=interval, progress=False, auto_adjust=True)
            if df.empty:
                # Manual Weekly Correction for empty result (try to build from daily)
                if interval == '1wk':
                    df = self._correct_weekly_candle(symbol, df)
                
                # If still empty after correction attempt, return
                if df.empty:
                    logger.warning(f"No data for {symbol}")
                    return pd.DataFrame()
            
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
            # Flatten: Drop the 'Ticker' level, keep 'Price' level (Open, High, Low, Close...)
            # Assuming single ticker download, this is safe.
            # Example columns: ('Close', 'AAPL'), ('High', 'AAPL') -> 'Close', 'High'
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
        Manually correct the last weekly candle using recent daily data.
        This handles cases where yfinance returns incomplete weekly data (e.g. up to Wed).
        """
        try:
             # Handle Japanese stocks (4 digits) -> Append .T
            ticker_symbol = symbol
            if symbol.isdigit() and len(symbol) == 4:
                ticker_symbol = f"{symbol}.T"

            df_daily = yf.download(ticker_symbol, period="1mo", interval="1d", progress=False, auto_adjust=True)
            if not df_daily.empty:
                # Ensure standard columns level
                if isinstance(df_daily.columns, pd.MultiIndex):
                    df_daily.columns = df_daily.columns.get_level_values(0)
                
                last_weekly_date = df.index[-1].date()
                # Find the start of that week (assuming Monday)
                week_start = last_weekly_date - timedelta(days=last_weekly_date.weekday())
                
                # Get daily data for this week
                this_week_daily = df_daily[df_daily.index.date >= week_start]
                
                if not this_week_daily.empty and len(this_week_daily) > 0:
                    # Re-aggregate
                    new_open = this_week_daily['Open'].iloc[0]
                    new_high = this_week_daily['High'].max()
                    new_low = this_week_daily['Low'].min()
                    new_close = this_week_daily['Close'].iloc[-1]
                    new_volume = this_week_daily['Volume'].sum()
                    
                    # Log correction
                    logger.info(f"Correcting weekly candle for {symbol} ({last_weekly_date}): "
                                f"Open {df['Open'].iloc[-1]:.2f}->{new_open:.2f}, "
                                f"Close {df['Close'].iloc[-1]:.2f}->{new_close:.2f}")
                    
                    # Replace last row
                    df.iloc[-1, df.columns.get_loc('Open')] = new_open
                    df.iloc[-1, df.columns.get_loc('High')] = new_high
                    df.iloc[-1, df.columns.get_loc('Low')] = new_low
                    df.iloc[-1, df.columns.get_loc('Close')] = new_close
                    df.iloc[-1, df.columns.get_loc('Volume')] = new_volume
                    
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
