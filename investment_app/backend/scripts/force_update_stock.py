
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlmodel import Session, select
from database import engine, Stock
from services.stock_service import stock_service
import pandas as pd
import json
from datetime import datetime

def update_stock(symbol):
    with Session(engine) as session:
        stock = session.get(Stock, symbol)
        if not stock:
            print(f"Stock {symbol} not found")
            return

        print(f"Updating {symbol}...")
        df = stock_service.get_stock_data(symbol, period='2y', interval='1d', force_refresh=True)
        
        if df.empty:
            print("No data found")
            return

        # Calculate SMAs
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
        
        stock.daily_chart_data = json.dumps(chart_data)
        stock.updated_at = datetime.utcnow()
        session.add(stock)
        session.commit()
        print(f"Updated {symbol} with 100MA")

if __name__ == "__main__":
    update_stock("VDE")
