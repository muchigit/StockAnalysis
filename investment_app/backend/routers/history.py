from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..database import get_session, TradeHistory
from datetime import datetime
from typing import List, Dict, Any
from collections import defaultdict

router = APIRouter(prefix="/history", tags=["history"])

from ..services.stock_service import stock_service
import pandas as pd
import numpy as np

def calculate_analytics(trades: List[TradeHistory]):
    # Sort trades by date (oldest first)
    sorted_trades = sorted(trades, key=lambda x: x.trade_date)
    
    # Pre-fetch Market Data for needed symbols
    # Optimize: Fetch in parallel
    unique_symbols = list(set(t.symbol for t in trades))
    market_data = {}
    
    import concurrent.futures

    def fetch_data(sym):
        try:
            # Use 5y only if necessary, or determine max range?
            # 5y is safe.
            df = stock_service.get_stock_data(sym, period="5y", interval="1d")
            if not df.empty:
                df.index = pd.to_datetime(df.index).normalize()
                return sym, df
        except Exception as e:
            print(f"Error fetching data for {sym}: {e}")
        return sym, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(fetch_data, unique_symbols)
        
    for sym, df in results:
        if df is not None:
            market_data[sym] = df


    # Portfolio State per Symbol
    # { symbol: { qty: float, total_cost: float, avg_cost: float } }
    portfolio = defaultdict(lambda: {"qty": 0.0, "total_cost": 0.0, "avg_cost": 0.0})
    
    # Analytics Data
    processed_history = []
    
    total_pl = 0.0
    total_trades_count = 0
    winning_trades_count = 0
    
    # Aggregates
    monthly_pl = defaultdict(float)
    weekly_pl = defaultdict(float)
    yearly_pl = defaultdict(float)

    for t in sorted_trades:
        sym = t.symbol
        pf = portfolio[sym]
        
        # Prepare expanded trade object
        trade_data = t.dict()
        trade_data['realized_pl'] = 0.0
        trade_data['roi_pct'] = 0.0
        trade_data['avg_cost'] = pf['avg_cost']
        
        # --- Post-Trade Performance Metrics ---
        # Calculate % change 1d, 5d, 20d, 50d after execution
        # Base price = t.price (Execution Price)
        
        trade_data['return_1d'] = None
        trade_data['return_5d'] = None
        trade_data['return_20d'] = None
        trade_data['return_50d'] = None

        if sym in market_data:
            df = market_data[sym]
            t_date = pd.Timestamp(t.trade_date).normalize()
            
            # Find location of trade date in DF
            # If exact match not found, find nearest NEXT trading day?
            # Or just use nearest key.
            # searchsorted works if sorted. DF index is sorted.
            
            try:
                # Get integer location
                # method='bfill' or 'ffill'? We want the trade day or immediately after.
                # get_indexer returns -1 if not found with 'exact' (default for non-unique index, but Date index is unique)
                # Let's use searchsorted to find position
                
                # Check if t_date is in range
                if t_date >= df.index[0] and t_date <= df.index[-1]:
                     # Use get_loc if exact, or searchsorted
                    if t_date in df.index:
                        idx = df.index.get_loc(t_date)
                        # If get_loc returns slice/array (duplicates), take first
                        if isinstance(idx, (slice, np.ndarray)):
                             idx = idx.start if isinstance(idx, slice) else idx[0]
                    else:
                        # Find insertion point (next day)
                        idx = df.index.searchsorted(t_date)
                    
                    # Convert idx to int just in case
                    idx = int(idx)

                    def get_forward_return(days_offset):
                        target_idx = idx + days_offset
                        if target_idx < len(df):
                            future_price = df['Close'].iloc[target_idx]
                            if t.price > 0:
                                return ((future_price - t.price) / t.price) * 100.0
                        return None

                    trade_data['return_1d'] = get_forward_return(1)
                    trade_data['return_5d'] = get_forward_return(5)
                    trade_data['return_20d'] = get_forward_return(20)
                    trade_data['return_50d'] = get_forward_return(50)
            except Exception as e:
                # print(f"Calc error: {e}") 
                pass

        # Normalize trade type
        t_type = t.trade_type.replace('買い', 'Buy').replace('売り', 'Sell') 
        is_buy = 'Buy' in t_type or 'BUY' in t_type.upper()
        is_sell = 'Sell' in t_type or 'SELL' in t_type.upper()

        if is_buy:
            # Update Average Cost
            cost = t.price * t.quantity
            new_qty = pf['qty'] + t.quantity
            new_total_cost = pf['total_cost'] + cost
            
            pf['qty'] = new_qty
            pf['total_cost'] = new_total_cost
            if new_qty > 0:
                pf['avg_cost'] = new_total_cost / new_qty
            
        elif is_sell:
            # Calculate P&L
            cost_basis = pf['avg_cost'] * t.quantity
            proceeds = t.price * t.quantity
            pl = proceeds - cost_basis
            roi = (pl / cost_basis * 100) if cost_basis > 0 else 0.0
            
            trade_data['realized_pl'] = pl
            trade_data['roi_pct'] = roi
            trade_data['cost_basis'] = cost_basis
            
            # Update Portfolio
            pf['qty'] = max(0, pf['qty'] - t.quantity)
            if pf['qty'] == 0:
                pf['total_cost'] = 0.0
                pf['avg_cost'] = 0.0
            else:
                pf['total_cost'] -= cost_basis
            
            # Aggregates
            total_pl += pl
            total_trades_count += 1
            if pl > 0:
                winning_trades_count += 1
                
            # Date-based Aggregation
            dt = t.trade_date
            month_key = dt.strftime("%Y-%m")
            year_key = dt.strftime("%Y")
            week_key = f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"
            
            monthly_pl[month_key] += pl
            yearly_pl[year_key] += pl
            weekly_pl[week_key] += pl

        processed_history.append(trade_data)

    # Sort processed history new to old for display
    processed_history.reverse()
    
    win_rate = (winning_trades_count / total_trades_count * 100) if total_trades_count > 0 else 0.0
    
    return {
        "stats": {
            "total_pl": total_pl,
            "win_rate": win_rate,
            "total_trades": total_trades_count,
            "monthly": monthly_pl,
            "weekly": weekly_pl,
            "yearly": yearly_pl
        },
        "history": processed_history
    }

@router.get("/analytics")
def get_history_analytics(session: Session = Depends(get_session)):
    try:
        trades = session.exec(select(TradeHistory)).all()
        return calculate_analytics(trades)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
