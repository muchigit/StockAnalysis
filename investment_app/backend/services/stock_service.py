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
                    # Cache integrity check for Weekly
                    if interval == '1wk' and len(df) > 2:
                        # Check last 2 rows diff
                        dates = df.index[-2:]
                        if len(dates) == 2:
                            diff_days = (dates[1] - dates[0]).days
                            if diff_days < 5:
                                logger.warning(f"Cached 1wk data for {symbol} looks like daily (diff={diff_days} days). Invalidating cache.")
                                raise ValueError("Invalid cache frequency")

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
                logger.warning(f"No data for {symbol}")
                return pd.DataFrame()
            
            # Normalize logic (MA calculation)
            df = self._add_technical_indicators(df)
            
            # Save to cache
            df.to_parquet(file_path)
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
            if 'Volume' in data.columns:
                data['Volume_MA50'] = data['Volume'].rolling(window=50).mean()
                data['Volume_MA200'] = data['Volume'].rolling(window=200).mean()
        except KeyError as e:
            logger.error(f"Missing column for MA calc: {e}")
        
        data = data.round(2)
        data.fillna(0, inplace=True)
        return data

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
