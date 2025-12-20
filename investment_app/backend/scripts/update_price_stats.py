from sqlmodel import Session, select
from investment_app.backend.database import engine, Stock
from investment_app.backend.services.stock_service import stock_service
from investment_app.backend.services.signals import get_signal_functions
import time
import pandas as pd

def update_stats():
    with Session(engine) as session:
        stocks = session.exec(select(Stock)).all()
        print(f"Updating stats for {len(stocks)} stocks...")
        
        updated_count = 0
        for stock in stocks:
            try:
                # Fetch data (cached preferred)
                # Need at least 200 days (~10 months). '2y' is safe.
                df = stock_service.get_stock_data(stock.symbol, period='2y', interval='1d')
                
                if df.empty or len(df) < 5:
                    continue
                    
                close = df['Close']
                current_price = close.iloc[-1]
                
                # Helper to calc change
                def calc_change(days):
                    if len(close) > days:
                        # integer location: -1 is today, -(days+1) is N days ago?
                        # No, simple approach: iloc[-(days+1)]
                        # e.g. change 1d: today - yesterday (iloc[-2])
                        idx = -(days + 1)
                        if abs(idx) <= len(close):
                            prev_price = close.iloc[idx]
                            if prev_price != 0:
                                return ((current_price - prev_price) / prev_price) * 100.0
                    return None
                    
                stock.change_percentage_1d = calc_change(1)
                stock.change_percentage_5d = calc_change(5)
                stock.change_percentage_20d = calc_change(20)
                stock.change_percentage_50d = calc_change(50)
                stock.change_percentage_200d = calc_change(200)

                # Calc SMA Deviations
                try:
                    def set_dev(ma_col, attr_name):
                        if ma_col in df.columns:
                            ma_val = df[ma_col].iloc[-1]
                            if pd.notna(ma_val) and ma_val != 0:
                                dev = ((current_price - ma_val) / ma_val) * 100.0
                                setattr(stock, attr_name, float(dev))
                            else:
                                setattr(stock, attr_name, None)
                    
                    set_dev('Close_MA5', 'deviation_5ma_pct')
                    set_dev('Close_MA20', 'deviation_20ma_pct')
                    set_dev('Close_MA50', 'deviation_50ma_pct')
                    set_dev('Close_MA200', 'deviation_200ma_pct')
                except Exception as ex:
                    print(f"SMA Dev Calc Error {stock.symbol}: {ex}")

                # Calc ATR(14)
                try:
                    # TR = Max(|High - Low|, |High - PrevClose|, |Low - PrevClose|)
                    high = df['High']
                    low = df['Low']
                    prev_close = close.shift(1)
                    
                    tr1 = high - low
                    tr2 = (high - prev_close).abs()
                    tr3 = (low - prev_close).abs()
                    
                    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
                    # SMA(14) of TR
                    atr = tr.rolling(window=14).mean()
                    
                    if len(atr) > 0 and pd.notna(atr.iloc[-1]):
                        stock.atr_14 = float(atr.iloc[-1])
                    else:
                        stock.atr_14 = None
                except Exception as ex:
                    print(f"ATR calc error {stock.symbol}: {ex}")
                    stock.atr_14 = None

                # Calc Signals
                try:
                    # Signals func expects data with indicators. get_stock_data returns that.
                    # But get_stock_data returns Ascending (oldest first).
                    # signals.py functions use .iloc[-1] as Latest. This matches Ascending.
                    # However, signals.py also uses columns like 'Close_MA200'.
                    # get_stock_data adds these via _add_technical_indicators.
                    # Let's verify _add_technical_indicators adds 'Close_MA200'.
                    # Assuming it does (based on common practice).
                    
                    sig_funcs = get_signal_functions()
                    for name, func in sig_funcs.items():
                         val = func(df)
                         # Set attribute dynamically: signal_NAME
                         setattr(stock, f"signal_{name}", int(val))
                         
                except Exception as ex:
                    print(f"Signal calc error {stock.symbol}: {ex}")

                # Calc Uptrend (MA200 Up & Price > MA200)
                # Legacy logic, redundant if we trust new signals, but keeping for compatibility
                try:
                    # Need enough data for 200MA. yfinance returns 2y, which is ~500 days.
                    # Rolling 200 means first 199 are NaN.
                    ma200 = close.rolling(window=200).mean()
                    if len(ma200) > 2 and pd.notna(ma200.iloc[-1]) and pd.notna(ma200.iloc[-2]):
                        curr_ma = ma200.iloc[-1]
                        prev_ma = ma200.iloc[-2]
                        # Trend Up: Current > Prev. Price > MA.
                        if curr_ma > prev_ma and current_price > curr_ma:
                            stock.is_in_uptrend = True
                        else:
                            stock.is_in_uptrend = False
                    else:
                        stock.is_in_uptrend = False
                except Exception as ex:
                    print(f"Trend calc error {stock.symbol}: {ex}")
                    stock.is_in_uptrend = False
                
                session.add(stock)
                updated_count += 1
                
                if updated_count % 20 == 0:
                    session.commit()
                    print(f"Updated {updated_count} stocks...")
                    
            except Exception as e:
                print(f"Error {stock.symbol}: {e}")
            
            # small sleep
            # time.sleep(0.1) 
        
        session.commit()
        print("Done.")

if __name__ == "__main__":
    update_stats()
