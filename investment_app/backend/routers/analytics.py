from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict
from sqlmodel import Session, select
from datetime import datetime, date
from pydantic import BaseModel
import pandas as pd
import numpy as np
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..database import get_session, Stock, TradeHistory
from ..services.stock_service import stock_service
from ..services.signals import get_signal_functions

router = APIRouter(prefix="/analytics", tags=["analytics"])

class HistoricalSignalRequest(BaseModel):
    target_date: str # YYYY-MM-DD
    end_date: Optional[str] = None # YYYY-MM-DD (Calculation Date)
    universe: str = "all" # all, holding, watchlist (for now just 'all' implemented mostly)

class SignalResult(BaseModel):
    symbol: str
    company_name: Optional[str]
    entry_price: float
    current_price: float
    return_pct: float
    max_return_pct: float
    min_return_pct: float
    active_signals: List[str] # List of signal names active at target_date
    status: str # Holding/None
    asset_type: Optional[str] = "stock" # stock, index, etf

    # New Fields
    daily_change_pct: Optional[float] = None # Change % on target_date
    dev_ma5: Optional[float] = None
    dev_ma20: Optional[float] = None
    dev_ma50: Optional[float] = None
    dev_ma200: Optional[float] = None

@router.post("/historical-signal", response_model=List[SignalResult])
def analyze_historical_signals(request: HistoricalSignalRequest, session: Session = Depends(get_session)):
    print(f"DEBUG: Received historical signal request: {request}")
    target_date_str = request.target_date
    try:
        target_date = pd.to_datetime(target_date_str).date()
        calc_end_date = pd.to_datetime(request.end_date).date() if request.end_date else date.today()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # 1. Fetch Universe
    query = select(Stock)
    # Filter by universe if needed (TODO)
    stocks = session.exec(query).all()
    
    # Pre-extract data to avoid passing SQLModel objects to threads
    stock_data_list = [{'symbol': s.symbol, 'company_name': s.company_name, 'asset_type': s.asset_type} for s in stocks]

    # 2. Parallel Processing
    results = []
    
    # helper for processing one stock
    def process_stock(symbol: str, company_name: Optional[str], asset_type: Optional[str]) -> Optional[SignalResult]:
        try:
            # Load Data (Use cache, fast)
            # Default fetch. might be 2y.
            df = stock_service.get_stock_data(symbol)
            
            if df.empty: 
                # Try fetching max if empty
                df = stock_service.get_stock_data(symbol, period="max", force_refresh=True)
                if df.empty: return None

            # Ensure index is datetime and sorted
            if not isinstance(df.index, pd.DatetimeIndex):
                df.index = pd.to_datetime(df.index)
            
            df.sort_index(inplace=True)

            # CHECK: Do we have enough history for 200MA calc at target_date?
            # We need ~365 days (trading days ~250) before target_date to be safe.
            required_start = target_date - pd.Timedelta(days=400)
            
            if df.index.min().date() > required_start:
                # Not enough history in cache. Force fetch MAX.
                # Only do this if target_date is actually older than what we have, OR we simply need more context.
                # If target_date is very recent, 2y cache (approx 730 days) is fine.
                # But if target_date is 2024-01-01 and cache starts 2023-12-01, we need more.
                
                # Double check if we truly need more data. 
                # If target_date is < df.index.min(), we DEFINITELY need more.
                # If target_date is existing but close to start, we need more for MA.
                
                try:
                    df = stock_service.get_stock_data(symbol, period="max", force_refresh=True)
                    if isinstance(df.index, pd.MultiIndex): # Just in case
                         df.columns = df.columns.get_level_values(0)
                    if not isinstance(df.index, pd.DatetimeIndex):
                        df.index = pd.to_datetime(df.index)
                    df.sort_index(inplace=True)
                except Exception as e:
                    print(f"Error fetching max data for {symbol}: {e}")
                    return None

            # Truncate for Signals: Data available ON or BEFORE target_date
            past_data = df[df.index.date <= target_date]
            
            if past_data.empty: return None
            
            # Calculate Signals
            active_signals = []
            signal_funcs = get_signal_functions()
            
            for name, func in signal_funcs.items():
                try:
                    # Some signal functions might expect specific length
                    if func(past_data) == 1:
                        active_signals.append(name)
                except:
                    pass
            
            if not active_signals:
                # Always include Indices/ETFs even if no signals
                is_index_or_etf = (asset_type in ['index', 'etf']) or symbol.startswith('^')
                if not is_index_or_etf:
                    return None
            
            # Calculate Returns
            # Entry Price: Price at target_date
            entry_price = past_data['Close'].iloc[-1]
            if entry_price == 0: return None

            # Calc Data: Data available ON or BEFORE calc_end_date
            # We need to find the price at calc_end_date.
            # Truncate df to end_date
            calc_data = df[df.index.date <= calc_end_date]
            if calc_data.empty: return None # Should not happen if past_data is not empty

            # Current Price: Price at calc_end_date (last available)
            current_price = calc_data['Close'].iloc[-1]
            
            # Extract additional metrics at target_date
            daily_change_pct = None
            if len(past_data) >= 2:
                prev_close = past_data['Close'].iloc[-2]
                if prev_close != 0:
                    daily_change_pct = ((entry_price - prev_close) / prev_close) * 100

            # Get deviations (using .get to handle missing columns safely, though they are added by stock_service)
            # Default to None if not present/nan
            def get_val(col):
                if col in past_data.columns:
                    val = past_data[col].iloc[-1]
                    if pd.notna(val): return float(val)
                return None

            dev_ma5 = get_val('Deviation_MA5')
            dev_ma20 = get_val('Deviation_MA20')
            dev_ma50 = get_val('Deviation_MA50')
            dev_ma200 = get_val('Deviation_MA200')

            return_pct = ((current_price - entry_price) / entry_price) * 100
            
            # Max/Min Return (Highest High / Lowest Low since target_date vs Entry)
            # data > target_date AND <= calc_end_date
            future_data = df[(df.index.date > target_date) & (df.index.date <= calc_end_date)]
            
            max_return_pct = return_pct # Default to current
            min_return_pct = return_pct # Default to current
            
            if not future_data.empty:
                max_high = future_data['High'].max()
                min_low = future_data['Low'].min()
                
                max_return_pct = ((max_high - entry_price) / entry_price) * 100
                min_return_pct = ((min_low - entry_price) / entry_price) * 100

            return SignalResult(
                symbol=symbol,
                company_name=company_name,
                entry_price=round(entry_price, 2),
                current_price=round(current_price, 2),
                return_pct=round(return_pct, 2),
                max_return_pct=round(max_return_pct, 2),
                min_return_pct=round(min_return_pct, 2),
                active_signals=active_signals,
                status="Unknown",
                asset_type=asset_type,
                daily_change_pct=round(daily_change_pct, 2) if daily_change_pct is not None else None,
                dev_ma5=round(dev_ma5, 2) if dev_ma5 is not None else None,
                dev_ma20=round(dev_ma20, 2) if dev_ma20 is not None else None,
                dev_ma50=round(dev_ma50, 2) if dev_ma50 is not None else None,
                dev_ma200=round(dev_ma200, 2) if dev_ma200 is not None else None
            )

        except Exception as e:
            print(f"Error processing {symbol}: {e}")
            return None

    # Run Threads
    def event_generator():
        results = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(process_stock, s['symbol'], s['company_name'], s['asset_type']): s for s in stock_data_list}
            total_tasks = len(futures)
            completed_tasks = 0
            
            for future in as_completed(futures):
                completed_tasks += 1
                try:
                    res = future.result()
                    if res:
                        results.append(res.dict())
                except Exception as exc:
                    print(f"Thread generated an exception: {exc}")
                
                # Yield progress update
                # Format: JSON line
                progress_event = {"type": "progress", "current": completed_tasks, "total": total_tasks}
                yield json.dumps(progress_event) + "\n"

        # Sort by return_pct desc (SignalResult needs to be dict for sorting if converted, or handle here)
        # We collected dicts above for easier serialization
        results.sort(key=lambda x: x['return_pct'], reverse=True)
        
        # Yield final result
        final_event = {"type": "complete", "data": results}
        yield json.dumps(final_event) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")
