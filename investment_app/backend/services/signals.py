import pandas as pd
import numpy as np

# --- Signal Functions ---

def higher_200ma(data):
  if data.empty: return 0
  return 1 if data['Close'].iloc[-1] > data['Close_MA200'].iloc[-1] else 0

def near_200ma(data):
  if data.empty: return 0
  if dev_200ma(None, data) > 40: return 0
  return 1

def over_50ma(data):
  if data.empty: return 0
  return 1 if data['Close'].iloc[-1] > data['Close_MA50'].iloc[-1] else 0

def higher_50ma_than_200ma(data):
  if data.empty: return 0
  c = data.iloc[-1]
  return 1 if c['Close_MA5'] > c['Close_MA20'] and c['Close_MA20'] > c['Close_MA50'] and c['Close_MA50'] > c['Close_MA200'] else 0

def uptrand_200ma(data):
  if data.empty or len(data) < 2: return 0
  ma200 = data['Close_MA200'].iloc[-1]
  ma200_prev = data['Close_MA200'].iloc[-2]
  if ma200_prev == 0: return 0
  return 1 if ((ma200 - ma200_prev) / ma200_prev) * 1000 > 2 else 0

def sameslope_50_200(data):
  sl200 = slope_200ma(None, data)
  sl50 = slope_50ma(None, data)
  return 1 if sl200 > 0 and (abs(sl200 - sl50) / sl200) <= 0.2 else 0

def newhigh(data):
    if data.empty: return 0
    return 1 if data['Close'].iloc[-1] == data['Close'].max() else 0

def newhigh_200days(data):
    if data.empty or len(data) < 200: return 0
    # Note: data.iloc[-1] is the LATEST. Logic in colab used iloc[0] as latest?
    # Provided code said: "最新の日付がインデックス0" (Latest date is index 0).
    # BUT yfinance usually returns Oldest date at index 0.
    # I need to CHECK if the provided code reversed the dataframe.
    # Provided code: "alldata = self.stock_data_instance.get_stock_data(symbol, asc=False)" -> Descending!
    # My StockService uses standard yfinance (Oldest first, Ascending).
    # CRITICAL: I must adapt the logic to use Ascending (Standard pandas) or Reverse the data passed to these functions.
    # Adapting functions to use .iloc[-1] (Last row = Latest) is better for standard DataFrames.
    # 'data['Close'].max()' covers the whole series anyway.
    # For 'newhigh_200days': data['Close'].tail(200).max() == data['Close'].iloc[-1]
    
    return 1 if data['Close'].iloc[-1] == data['Close'].tail(200).max() else 0

def newhigh_100days(data):
    if data.empty or len(data) < 100: return 0
    return 1 if data['Close'].iloc[-1] == data['Close'].tail(100).max() else 0

def newhigh_50days(data):
    if data.empty or len(data) < 50: return 0
    return 1 if data['Close'].iloc[-1] == data['Close'].tail(50).max() else 0

def high_volume(data):
  if data.empty: return 0
  return 1 if data['Volume'].iloc[-1] >= data['Volume_MA50'].iloc[-1] * 1.3 else 0

def price_up(data):
  if data.empty or len(data) < 2: return 0
  return 1 if data['Close'].iloc[-1] > data['Close'].iloc[-2] * 1.01 else 0

def break_atr(data):
  if atr_4w(None, data) <= 3 and close_ratio(None, data) > atr_4w(None, data):
    return 1
  return 0

def high_slope5ma(data):
  if slope_5ma(None, data) >= 20 and dev_5ma(None, data) < 10 and dev_200ma(None, data) <= 30 and dev_20ma(None, data) <= 20 and uptrand_200ma(data) > 0 and higher_50ma_than_200ma(data) > 0:
    return 1
  return 0

# --- Info/Tech Functions (Assuming Ascending Data [-1] is latest) ---

def close_price(info, data):
  return data['Close'].iloc[-1]

def close_ratio(info, data):
  close = data['Close'].iloc[-1]
  prev_close = data['Close'].iloc[-2]
  return round((close - prev_close)/ prev_close * 100, 1)

def dev_200ma(info, data):
  close = data['Close'].iloc[-1]
  ma200 = data['Close_MA200'].iloc[-1]
  if ma200 == 0: return 0
  return round((close - ma200) / ma200 * 100, 1)

def dev_50ma(info, data):
  close = data['Close'].iloc[-1]
  ma50 = data['Close_MA50'].iloc[-1]
  if ma50 == 0: return 0
  return round((close - ma50) / ma50 * 100, 1)

def dev_20ma(info, data):
  close = data['Close'].iloc[-1]
  ma20 = data['Close_MA20'].iloc[-1]
  if ma20 == 0: return 0
  return round((close - ma20) / ma20 * 100, 1)

def dev_5ma(info, data):
  close = data['Close'].iloc[-1]
  ma5 = data['Close_MA5'].iloc[-1]
  if ma5 == 0: return 0
  return round((close - ma5) / ma5 * 100, 1)

def gain_volume(info, data):
  vol = data['Volume'].iloc[-1]
  ma50 = data['Volume_MA50'].iloc[-1]
  if ma50 == 0: return 0
  return round((vol - ma50) / ma50 * 100, 1)

def slope_200ma(info, data):
  ma200 = data['Close_MA200'].iloc[-1]
  ma200_prev = data['Close_MA200'].iloc[-2]
  if ma200_prev == 0: return 0
  return round((ma200 - ma200_prev) / ma200_prev * 1000, 1)

def slope_50ma(info, data):
  ma50 = data['Close_MA50'].iloc[-1]
  ma50_prev = data['Close_MA50'].iloc[-2]
  if ma50_prev == 0: return 0
  return round((ma50 - ma50_prev) / ma50_prev * 1000, 1)

def slope_20ma(info, data):
  ma20 = data['Close_MA20'].iloc[-1]
  ma20_prev = data['Close_MA20'].iloc[-2]
  if ma20_prev == 0: return 0
  return round((ma20 - ma20_prev) / ma20_prev * 1000, 1)

def slope_5ma(info, data):
  ma5 = data['Close_MA5'].iloc[-1]
  ma5_prev = data['Close_MA5'].iloc[-2]
  if ma5_prev == 0: return 0
  return round((ma5 - ma5_prev) / ma5_prev * 1000, 1)

def atr_4w(info, data):
    return calculate_atr(data, 20) 

def calculate_atr(df, period):
    # Calculate ATR for the *latest* date (index -1) based on previous `period` days
    # True Range = max(High-Low, |High-PrevClose|, |Low-PrevClose|)
    # Use pandas rolling?
    
    # Simple TR calculation for the last 'period' days
    # We need the last `period` + 1 rows
    if len(df) < period + 1: return 0
    
    target_df = df.tail(period + 1).copy()
    target_df['PrevClose'] = target_df['Close'].shift(1)
    target_df['TR'] = np.maximum(
        target_df['High'] - target_df['Low'],
        np.maximum(
            abs(target_df['High'] - target_df['PrevClose']),
            abs(target_df['Low'] - target_df['PrevClose'])
        )
    )
    atr_val = target_df['TR'].tail(period).mean() # Average of TRs
    
    close = df['Close'].iloc[-1]
    if close == 0: return 0
    return round((atr_val / close) * 100, 2)


# Mapping function to get signal list
def get_signal_functions():
    return {
        "higher_200ma": higher_200ma,
        "near_200ma": near_200ma,
        "over_50ma": over_50ma,
        "higher_50ma_than_200ma": higher_50ma_than_200ma,
        "uptrand_200ma": uptrand_200ma,
        "sameslope_50_200": sameslope_50_200,
        "newhigh": newhigh,
        "newhigh_200days": newhigh_200days,
        "newhigh_100days": newhigh_100days,
        "newhigh_50days": newhigh_50days,
        "high_volume": high_volume,
        "price_up": price_up,
        "break_atr": break_atr,
        "high_slope5ma": high_slope5ma,
        "rebound_5ma": rebound_5ma,
        "base_formation": base_formation
    }

def rebound_5ma(data):
    # Condition:
    # 1. Current 5MA Slope > 0
    # 2. 5MA Slope 5 days ago < 0
    # 3. Close > 5MA
    
    if data.empty or len(data) < 7: return 0
    
    # 1. Current Slope > 0
    current_slope = slope_5ma(None, data)
    if current_slope <= 0: return 0
    
    # 3. Close > 5MA
    if data['Close'].iloc[-1] <= data['Close_MA5'].iloc[-1]: return 0
    
    # 2. Slope 5 days ago < 0
    # Slope calculation uses (Ma5[t] - Ma5[t-1]) / Ma5[t-1]
    # We need slope at t-5. So we need Ma5[t-5] and Ma5[t-6].
    # data.iloc[-1] is t. data.iloc[-6] is t-5. data.iloc[-7] is t-6.
    
    ma5_t5 = data['Close_MA5'].iloc[-6]
    ma5_t6 = data['Close_MA5'].iloc[-7]
    
    if ma5_t6 == 0: return 0
    
    slope_t5 = (ma5_t5 - ma5_t6) / ma5_t6 * 1000
    
    if slope_t5 >= 0: return 0
    
    return 1

def base_formation(data):
    """
    Signal: Base Formation (Tight Area)
    Criteria:
    1. Flatness: (Max(Close_10d) - Min(Close_10d)) / Min(Close_10d) <= 0.05
    2. Volume Contraction: Avg(Vol_10d) < Avg(Vol_prev_20d)
    """
    if data.empty or len(data) < 30: return 0
    
    # 1. Price Flatness (Last 10 days)
    # data.iloc[-1] is latest. data.iloc[-10:] is last 10 rows.
    last_10 = data.tail(10)
    max_close = last_10['Close'].max()
    min_close = last_10['Close'].min()
    
    if min_close == 0: return 0
    
    range_pct = (max_close - min_close) / min_close
    if range_pct > 0.05: return 0
    
    # 2. Volume Contraction
    # Avg Volume last 10 days
    avg_vol_10 = last_10['Volume'].mean()
    
    # Avg Volume previous 20 days (t-10 to t-29)
    # slice: data.iloc[-30:-10]
    prev_20 = data.iloc[-30:-10]
    avg_vol_prev20 = prev_20['Volume'].mean()
    
    if avg_vol_10 >= avg_vol_prev20: return 0
    
    return 1
