from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
from ..database import get_session, Stock, TradeHistory, StockNews, StockFinancials
from ..services.stock_service import stock_service
from ..services.signals import get_signal_functions
from ..services.gemini_service import gemini_service
from ..services.chart_generator import chart_generator
import pandas as pd
import json

router = APIRouter(prefix="/stocks", tags=["stocks"])

from sqlmodel import Session, select, text
from pydantic import BaseModel

class StockUpdateRequest(BaseModel):
    composite_rating: Optional[int] = None
    rs_rating: Optional[int] = None
    is_hidden: Optional[bool] = None
    is_buy_candidate: Optional[bool] = None
    analysis_file_path: Optional[str] = None
    # For now, we auto-set date on update or allow manual? Requirement said "save button updates with current date"


from ..schemas import StockResponse

@router.get("/", response_model=List[StockResponse])
def list_stocks(
    offset: int = 0, 
    limit: int = 2000, 
    asset_type: str = "stock", 
    show_hidden_only: bool = False,
    lite: bool = False,
    session: Session = Depends(get_session)
):
    # Fetch stocks
    query = select(Stock).offset(offset).limit(limit)
    if asset_type:
        query = query.where(Stock.asset_type == asset_type)
        
    if show_hidden_only:
        query = query.where(Stock.is_hidden == True)
    else:
        query = query.where(Stock.is_hidden == False)
        
    stocks = session.exec(query).all()
    
    if lite:
        # Fast path for Heatmap/etc.
        # We need holding status for highlighting, but P&L is heavy.
        # Efficient strategy: Get all symbols with non-zero holdings first.
        # or simplified loop.
        
        # 1. Fetch current holdings map (aggregated)
        # To avoid heavy P&L loop, just sum trade qtys per symbol.
        target_symbols = [s.symbol for s in stocks]
        
        # This is a bit inefficient to run for every heatmap fetch if we have 5000 stocks...
        # But SQL sum is fast.
        # However, for 2000 stocks, `IN` clause is big.
        # Better: Fetches all trades for these stocks is what we avoided. 
        # Is there a "CurrentHoldings" view? No.
        # TradeHistory has all trades.
        # Let's do a simplified query: SELECT symbol, SUM(CASE WHEN type='Buy' THEN qty ELSE -qty END) ... 
        # But types are Japanese string '買い', '売り'.
        
        # Use Python set for holdings if total dataset isn't huge? 
        # Or, just accept that Lite mode returns holding_qty=0 for now vs user requirement.
        # User WANTS holding highlight.
        
        # Compromise: Fetch ONLY trades for the requested stocks (target_symbols) and compute quantity only.
        # Skip notes, skip GDrive, skip analysis, skip complex P&L.
        
        trades = session.exec(select(TradeHistory.symbol, TradeHistory.trade_type, TradeHistory.quantity).where(TradeHistory.symbol.in_(target_symbols))).all()
        
        holdings = {}
        for (sym, t_type, qty) in trades:
            if sym not in holdings: holdings[sym] = 0.0
            if t_type == '買い': holdings[sym] += qty
            elif t_type == '売り': holdings[sym] -= qty
            
        response = []
        for s in stocks:
            qty = holdings.get(s.symbol, 0.0)
            
            resp = StockResponse(
                **s.dict(),
                holding_quantity=qty, # Pass actual qty
                trade_count=0,
                status="Holding" if qty > 0.0001 else "None",
                last_buy_date=None,
                last_sell_date=None, 
                realized_pl=0.0,
                unrealized_pl=0.0,
                average_cost=0.0,
                note=None,
                latest_analysis=None
            )
            response.append(resp)
        return response

    # Calculate holdings for these stocks
    # Note: For strict correctness, we should query all history or group by symbol.
    # Since we paginate stocks, we can filter history by these symbols OR just fetch aggregate for all (if dataset small).
    # Group By query is efficient.
    
    # Fetch all trades for these stocks to calculate analytics
    # Ideally should use a join, but for simplicity and P&L logic app consistency, we fetch and process.
    # Fetch all trades for these stocks to calculate analytics
    # Ideally should use a join, but for simplicity and P&L logic app consistency, we fetch and process.
    target_symbols = [s.symbol for s in stocks]
    trades = session.exec(select(TradeHistory).where(TradeHistory.symbol.in_(target_symbols)).order_by(TradeHistory.trade_date.asc())).all()

    # Fetch notes for these stocks
    from ..database import StockNote, AnalysisResult
    notes = session.exec(select(StockNote).where(StockNote.symbol.in_(target_symbols))).all()
    notes_map = {n.symbol: n.content for n in notes}

    # Fetch latest analysis for these stocks
    # We want the latest one per symbol. A simple way in app logic:
    # Fetch all analysis for these symbols, ordered by date desc
    analysis_map = {}
    
    # 1. Fetch from GDrive (Base layer)
    from ..services.gdrive_loader import gdrive_loader
    gdrive_summaries = gdrive_loader.get_latest_summaries()
    for sym, summary in gdrive_summaries.items():
        if sym in target_symbols:
            analysis_map[sym] = summary

    # 2. Fetch from DB (Overlay layer - DB results might be newer or more specific if generated by system)
    all_analysis = session.exec(select(AnalysisResult).where(AnalysisResult.symbol.in_(target_symbols)).order_by(AnalysisResult.created_at.desc())).all()
    for a in all_analysis:
        if a.symbol not in analysis_map: # Prioritize what? If DB is empty, this fills. If DB has it, we might want to overwrite or keep GDrive?
            # Let's assume DB is "System generated" and GDrive is "External Report".
            # For now, if DB has latest, use it. But here DB is empty. 
            # Simple logic: if not in map, add it. If in map (from GDrive), maybe keep GDrive as it is "Human/External" source?
            # Let's prioritize GDrive for this user request context. 
            # Or better: Just use DB if GDrive missing.
            analysis_map[a.symbol] = a.content
        # If we wanted DB to overwrite GDrive, we'd remove the 'if not in map' check.
        # But previous logs showed DB empty, so this is safe.

    # Aggregate by symbol
    stock_analytics = _calculate_stats(trades)

    response = []
    for s in stocks:
        stats = stock_analytics.get(s.symbol, {
            'qty': 0.0, 'cnt': 0, 'last_buy': None, 'last_sell': None, 'realized_pl': 0.0, 'total_cost': 0.0
        })
        
        qty = stats['qty']
        cnt = stats['cnt']
        
        # Calculate Unrealized P&L
        avg_cost = 0.0
        unrealized_pl = 0.0
        if qty > 0.0001:
            avg_cost = stats.get('total_cost', 0) / qty
            current_price = s.current_price or 0
            if current_price > 0:
                unrealized_pl = (current_price - avg_cost) * qty

        status = "None"
        if qty > 0.0001:
            status = "Holding"
        elif cnt > 0:
            status = "Past Trade"
            
        latest = analysis_map.get(s.symbol)
        if not latest and s.analysis_file_path:
            import os
            fname = os.path.basename(s.analysis_file_path)
            date_str = s.analysis_linked_at.strftime('%Y-%m-%d') if s.analysis_linked_at else datetime.utcnow().strftime('%Y-%m-%d')
            # If manually linked, show date and filename
            latest = f"[{date_str}] {fname}"

        resp = StockResponse(
            **s.dict(),
            holding_quantity=qty,
            trade_count=cnt,
            status=status,
            last_buy_date=stats['last_buy'],
            last_sell_date=stats['last_sell'],
            realized_pl=stats['realized_pl'],
            unrealized_pl=unrealized_pl,
            average_cost=avg_cost,
            note=notes_map.get(s.symbol),
            latest_analysis=latest
        )
        response.append(resp)
        
    return response

@router.get("/{symbol}", response_model=StockResponse)
def get_stock_detail(symbol: str, session: Session = Depends(get_session)):
    stock = session.get(Stock, symbol)
    if not stock:
        # Auto-register if not found
        info = stock_service.get_stock_info(symbol)
        if info and ('symbol' in info or 'shortName' in info):
            # Create new stock
            # yfinance info keys vary. 'shortName' or 'longName' usually exist.
            # J-stocks (xxxx.T) usually work.
            company_name = info.get('shortName') or info.get('longName') or symbol
            sector = info.get('sector', 'Unknown')
            industry = info.get('industry', 'Unknown')
            mcap = info.get('marketCap')
            
            stock = Stock(
                symbol=symbol,
                company_name=company_name,
                sector=sector,
                industry=industry,
                market_cap=mcap
            )
            session.add(stock)
            session.commit()
            session.refresh(stock)
        else:
             raise HTTPException(status_code=404, detail="Stock not found")
        
    # Fetch trades
    trades = session.exec(select(TradeHistory).where(TradeHistory.symbol == symbol).order_by(TradeHistory.trade_date.asc())).all()
    analytics = _calculate_stats(trades)
    stats = analytics.get(symbol, {
        'qty': 0.0, 'cnt': 0, 'last_buy': None, 'last_sell': None, 'realized_pl': 0.0
    })

    # Fetch Note
    from ..database import StockNote, AnalysisResult
    note_obj = session.get(StockNote, symbol)
    note_content = note_obj.content if note_obj else None

    # Fetch Latest Analysis
    # Reuse logic: fetch GDrive, fetch DB using session
    analysis_content = None
    # 1. GDrive
    from ..services.gdrive_loader import gdrive_loader
    gdrive_summaries = gdrive_loader.get_latest_summaries()
    if symbol in gdrive_summaries:
        analysis_content = gdrive_summaries[symbol]
    
    # 2. DB (Order by date desc, get first)
    db_analysis = session.exec(select(AnalysisResult).where(AnalysisResult.symbol == symbol).order_by(AnalysisResult.created_at.desc()).limit(1)).first()
    if db_analysis:
         # Simple priority: if DB exists, use it? Or use GDrive if newer? 
         # For simplicity and consistency with list, if DB exists use it, if not check GDrive?
         # List logic was: "if not in map (which was filled by GDrive), add DB". Wait, list logic was:
         # 1. Fill map from GDrive.
         # 2. Loop DB. If nut in map, add. -> DB fills gaps. GDrive takes precedence if present?
         # Actually logic was:
         # for a in all_analysis: if a.symbol not in analysis_map: analysis_map[...] = ...
         # This means GDrive (loaded first) takes precedence.
         # So here:
         if not analysis_content:
             analysis_content = db_analysis.content
         # If analysis_content from GDrive is present, we keep it.

    # 3. Manually Linked File Injection (Highest Priority for List View logic if we were listing, 
    # but here we just return 'latest_analysis' string.
    # The requirement is "explicitly link file path". 
    # If a file path is linked, should we show that as "latest_analysis"?
    # The 'latest_analysis' field is string content.
    # If we have a file path, maybe we should prepend a link or notice?
    # Or rely on the frontend to show the file link separately.
    # The frontend plan says: "Display current linked path (if any)".
    # So we don't necessarily need to jam it into 'latest_analysis' string.
    # BUT, the plan also said "Update `get_analysis_history` to inject linked file".
    # Wait, `get_stock_detail` returns `StockResponse` which inherits `Stock`.
    # `Stock` now has `analysis_file_path`.
    # So the frontend will receive `analysis_file_path` directly!
    # We don't need to inject it into `latest_analysis` string unless we want it to show up in that specific text block.
    # However, for `list_stocks` (the table view), we might want to know if there is a file.
    # `StockResponse` has `latest_analysis` (string).
    # `Stock` has `analysis_file_path`.
    # So the data is already there in the `Stock` part of `StockResponse`.
    
    # Let's just ensure `analysis_file_path` is passed. It is part of `Stock` model, so `**stock.dict()` covers it.
    
    qty = stats['qty']
    cnt = stats['cnt']
    status = "None"
    if qty > 0.0001:
        status = "Holding"
    elif cnt > 0:
        status = "Past Trade"

    return StockResponse(
        **stock.dict(),
        holding_quantity=qty,
        trade_count=cnt,
        status=status,
        last_buy_date=stats['last_buy'],
        last_sell_date=stats['last_sell'],
        realized_pl=stats['realized_pl'],
        note=note_content,
        latest_analysis=analysis_content
    )

@router.put("/{symbol}", response_model=Stock)
def update_stock(symbol: str, update_data: StockUpdateRequest, session: Session = Depends(get_session)):
    stock = session.get(Stock, symbol)
    if not stock:
        # Should we creating it? Usually update implies existence.
        # But if we access a stock that doesn't exist in DB but exists in trade history... 
        # For now, assume stock exists or user imported it.
        raise HTTPException(status_code=404, detail="Stock not found")
        
    if update_data.composite_rating is not None:
        stock.composite_rating = update_data.composite_rating
    if update_data.rs_rating is not None:
        stock.rs_rating = update_data.rs_rating
    if update_data.is_hidden is not None:
        stock.is_hidden = update_data.is_hidden
    if update_data.is_buy_candidate is not None:
        stock.is_buy_candidate = update_data.is_buy_candidate
    if update_data.analysis_file_path is not None:
        stock.analysis_file_path = update_data.analysis_file_path
        if update_data.analysis_file_path:
             stock.analysis_linked_at = datetime.utcnow()
        else:
             stock.analysis_linked_at = None
        
    # Update date if any rating changed
    if update_data.composite_rating is not None or update_data.rs_rating is not None:
        stock.ibd_rating_date = datetime.utcnow()
        
    stock.updated_at = datetime.utcnow()
    session.add(stock)
    session.commit()
    session.refresh(stock)
    return stock

class CreateStockRequest(BaseModel):
    symbol: str
    asset_type: str = "stock"

@router.post("/", response_model=Stock)
def create_stock(request: CreateStockRequest, session: Session = Depends(get_session)):
    symbol = request.symbol.upper()
    stock = session.get(Stock, symbol)
    if stock:
        raise HTTPException(status_code=400, detail="Stock already exists")
    
    # Auto-fetch info
    info = stock_service.get_stock_info(symbol)
    if not info or ('symbol' not in info and 'shortName' not in info and 'longName' not in info):
         pass
    
    company_name = symbol
    sector = "Unknown"
    industry = "Unknown"
    mcap = None
    
    if info:
        company_name = info.get('shortName') or info.get('longName') or symbol
        sector = info.get('sector', 'Unknown')
        industry = info.get('industry', 'Unknown')
        mcap = info.get('marketCap')
    
    stock = Stock(
        symbol=symbol,
        company_name=company_name,
        sector=sector,
        industry=industry,
        market_cap=mcap,
        asset_type=request.asset_type
    )

    # Calculate initial performance metrics
    try:
        df = stock_service.get_stock_data(symbol, period="2y", interval="1d")
        metrics = stock_service.calculate_performance_metrics(df)
        stock.change_percentage_1d = metrics.get('change_percentage_1d')
        stock.change_percentage_5d = metrics.get('change_percentage_5d')
        stock.change_percentage_20d = metrics.get('change_percentage_20d')
        stock.change_percentage_50d = metrics.get('change_percentage_50d')
        stock.change_percentage_200d = metrics.get('change_percentage_200d')
    except Exception as e:
        print(f"Failed to calculate initial metrics for {symbol}: {e}")

    session.add(stock)
    session.commit()
    session.refresh(stock)
    return stock
@router.delete("/{symbol}")
def delete_stock(symbol: str, session: Session = Depends(get_session)):
    stock = session.get(Stock, symbol)
    if not stock:
        # Check if we have only trades but no stock record?
        # Just proceed to clean up related data even if Stock record is missing
        pass
        
    # Delete related data
    # 1. TradeHistory
    trades = session.exec(select(TradeHistory).where(TradeHistory.symbol == symbol)).all()
    for t in trades:
        session.delete(t)
        
    # 2. StockNote
    note = session.get(StockNote, symbol)
    if note:
        session.delete(note)
        
    # 3. AnalysisResult
    analyses = session.exec(select(AnalysisResult).where(AnalysisResult.symbol == symbol)).all()
    for a in analyses:
        session.delete(a)
        
    # 4. Stock Record
    if stock:
        session.delete(stock)
        
    session.commit()
    
    # 5. Delete Cache
    stock_service.delete_cache(symbol)
    
    return {"status": "deleted", "symbol": symbol}


def _calculate_stats(trades: List[TradeHistory]) -> dict:
    stock_analytics = {} 
    for t in trades:
        if t.symbol not in stock_analytics:
            stock_analytics[t.symbol] = {
                'qty': 0.0, 
                'cnt': 0, 
                'last_buy': None, 
                'last_sell': None,
                'total_cost': 0.0,
                'realized_pl': 0.0
            }
        
        data = stock_analytics[t.symbol]
        data['cnt'] += 1
        
        date_str = t.trade_date.strftime('%Y-%m-%d') if t.trade_date else None
        
        if t.trade_type == '買い':
            data['total_cost'] += (t.price * t.quantity)
            data['qty'] += t.quantity
            # Update last buy if this trade is later (trades are sorted asc, so always update)
            data['last_buy'] = date_str
            
        elif t.trade_type == '売り':
            # Calc PL
            avg_cost = (data['total_cost'] / data['qty']) if data['qty'] > 0 else 0
            pl = (t.price - avg_cost) * t.quantity
            data['realized_pl'] += pl
            
            # Reduce
            data['qty'] -= t.quantity
            data['total_cost'] -= (avg_cost * t.quantity)
            if data['qty'] < 0.0001:
                data['qty'] = 0
                data['total_cost'] = 0
                
            data['last_sell'] = date_str
    return stock_analytics

@router.get("/{symbol}/price_history")
def get_stock_price_history(symbol: str, days: int = 100):
    # Get standard data (usually 2y is cached)
    df = stock_service.get_stock_data(symbol, period="2y", interval="1d")
    if df.empty:
        return []
    
    # Slice last N days
    df_slice = df.tail(days).copy()
    
    # Reset index to make Date a column
    df_slice.reset_index(inplace=True)
    
    # Convert to list of dicts
    # Dates to string
    records = []
    for _, row in df_slice.iterrows():
        rec = row.to_dict()
        # Convert Timestamp to string
        for k, v in rec.items():
            if hasattr(v, 'isoformat'):
                try:
                    rec[k] = v.strftime('%Y-%m-%d')
                except:
                    rec[k] = str(v)
    
        records.append(rec)
        
    return records

@router.get("/{symbol}/chart")
def get_stock_chart(symbol: str, period: str = "2y", interval: str = "1d"):
    """Return JSON friendly chart data (OHLCV)"""
    df = stock_service.get_stock_data(symbol, period=period, interval=interval)
    if df.empty:
        return []
    
    # Format for Lightweight Charts: { time: '2018-12-22', open: 75.16, high: 82.84, low: 36.16, close: 45.72 }
    # Calculate SMAs
    if interval == '1d':
        periods = [5, 20, 50, 100, 200]
    elif interval == '1wk':
        periods = [4, 10, 20, 40]
    else:
        periods = []

    for p in periods:
        df[f'sma{p}'] = df['Close'].rolling(window=p).mean()

    # Reset index to get Date as column
    df_reset = df.reset_index()
    
    # Check column names (yfinance uses 'Date')
    date_col = 'Date' if 'Date' in df_reset.columns else df_reset.columns[0]
    
    result = []
    for _, row in df_reset.iterrows():
        try:
            item = {
                "time": row[date_col].strftime("%Y-%m-%d"),
                "open": row['Open'],
                "high": row['High'],
                "low": row['Low'],
                "close": row['Close'],
                "volume": row['Volume']
            }
            # Add SMAs
            for p in periods:
                val = row[f'sma{p}']
                # Handle NaN
                item[f'sma{p}'] = val if pd.notna(val) else None
                
            result.append(item)
        except Exception as e:
            continue
            
    return result

@router.get("/{symbol}/signals")
def get_stock_signals(symbol: str):
    """Calculate and return signals for the stock"""
    df = stock_service.get_stock_data(symbol)
    if df.empty:
        return {"error": "No data"}
        
    signals = {}
    signal_funcs = get_signal_functions()
    
    for name, func in signal_funcs.items():
        try:
            # Note: our signals assume standard Ascending data (checked in signals.py)
            signals[name] = int(func(df))
        except Exception as e:
            signals[name] = -1 # Error
            
    return signals
            

@router.get("/{symbol}/history", response_model=List[TradeHistory])
def get_trade_history(symbol: str, session: Session = Depends(get_session)):
    """Return trade history for the stock"""
    trades = session.exec(select(TradeHistory).where(TradeHistory.symbol == symbol).order_by(TradeHistory.trade_date.desc())).all()
    return trades

# --- Notes ---
from ..database import StockNote, AnalysisResult
from pydantic import BaseModel

class NoteUpdate(BaseModel):
    content: str

@router.get("/{symbol}/note", response_model=StockNote)
def get_note(symbol: str, session: Session = Depends(get_session)):
    note = session.get(StockNote, symbol)
    if not note:
        # Return empty default
        return StockNote(symbol=symbol, content="")
    return note

@router.post("/{symbol}/note", response_model=StockNote)
def update_note(symbol: str, note_update: NoteUpdate, session: Session = Depends(get_session)):
    note = session.get(StockNote, symbol)
    if not note:
        note = StockNote(symbol=symbol, content=note_update.content)
    else:
        note.content = note_update.content
        note.updated_at = datetime.utcnow()
    
    session.add(note)
    session.commit()
    session.refresh(note)
    return note

# --- Analysis ---

from ..services.gdrive_loader import gdrive_loader

@router.get("/{symbol}/analysis", response_model=List[AnalysisResult])
def get_analysis_history(symbol: str, session: Session = Depends(get_session)):
    # 1. Fetch DB Results
    db_results = session.exec(select(AnalysisResult).where(AnalysisResult.symbol == symbol).order_by(AnalysisResult.created_at.desc())).all()
    
    # 0. Check manual link
    stock = session.get(Stock, symbol)
    manual_results = []
    if stock and stock.analysis_file_path:
        import os
        date_str = stock.analysis_linked_at.strftime('%Y-%m-%d') if stock.analysis_linked_at else datetime.utcnow().strftime('%Y-%m-%d')
        manual_results.append(AnalysisResult(
            symbol=symbol,
            content=f"[{date_str}] {os.path.basename(stock.analysis_file_path)}",
            created_at=stock.analysis_linked_at or datetime.utcnow(),
            file_path=stock.analysis_file_path,
            id=-999 # Pseudo ID
        ))
    
    # 2. Fetch GDrive Results
    gdrive_data = gdrive_loader.search_reports(symbol)
    
    # Convert GDrive dicts to AnalysisResult objects (non-persisted)
    gdrive_results = []
    for d in gdrive_data:
        # Use a large negative ID to avoid collision with DB IDs (if needed by frontend key)
        # Use simple object passing
        res = AnalysisResult(
            symbol=d['symbol'],
            content=d['content'],
            created_at=d['created_at'],
            file_path=d.get('file_path')
        )
        # Manually set ID if needed for frontend key
        res.id = d['id']  
        gdrive_results.append(res)

    # 3. Merge and Sort
    # Combine (Manual first, then DB/GDrive)
    combined = manual_results + list(db_results) + gdrive_results
    combined.sort(key=lambda x: x.created_at or datetime.min, reverse=True)
    
    combined = manual_results + list(db_results) + gdrive_results
    combined.sort(key=lambda x: x.created_at or datetime.min, reverse=True)
    
    return combined

@router.delete("/{symbol}/analysis/{analysis_id}")
def delete_analysis_result(symbol: str, analysis_id: int, session: Session = Depends(get_session)):
    analysis = session.get(AnalysisResult, analysis_id)
    if not analysis:
        # It might be a GDrive result (negative ID) or just missing
        if analysis_id < 0:
             raise HTTPException(status_code=400, detail="Cannot delete external GDrive reports from here.")
        raise HTTPException(status_code=404, detail="Analysis result not found")
        
    session.delete(analysis)
    session.commit()
    return {"status": "deleted", "id": analysis_id}

@router.post("/{symbol}/analysis/trigger")
def trigger_analysis(symbol: str):
    # TODO: Connect to Gemini Service
    # For now, create a dummy placeholder analysis to demonstrate UI
    # In real implementation, this would queue a background task
    return {"status": "Analysis triggered (Placeholder)"}


@router.post("/{symbol}/analysis/visual", response_model=AnalysisResult)
def trigger_visual_analysis(symbol: str, session: Session = Depends(get_session)):
    # 1. Get Data
    df = stock_service.get_stock_data(symbol, period="1y", interval="1d")
    if df.empty:
        raise HTTPException(status_code=404, detail="Stock data not found")
        
    # 2. Generate Chart
    # Use 1y period for good pattern context
    chart_path = chart_generator.generate_chart_image(symbol, df, period_label="1 Year Daily")
    if not chart_path:
        raise HTTPException(status_code=500, detail="Failed to generate chart image")
        
    # 3. Call Gemini
    prompt = """
    Please analyze this stock chart image.
    1. Identify the primary trend (Uptrend, Downtrend, Consolidation).
    2. Identify any visible chart patterns (e.g., Cup with Handle, Double Bottom, Head and Shoulders, Base Formation, Tight Areas).
    3. Observe the relationship between price and Moving Averages (5, 20, 50, 200).
    4. Observe Volume anomalies.
    
    Provide a "Bullish", "Bearish", or "Neutral" rating and a concise analysis summary strictly in Japanese.
    Format using Markdown.
    """
    
    result_text = gemini_service.generate_content_with_image(prompt, chart_path)
    
    if "Error" in result_text and len(result_text) < 50:
         raise HTTPException(status_code=500, detail=result_text)
    
    # 4. Save Result
    analysis = AnalysisResult(
        symbol=symbol,
        content=result_text,
        created_at=datetime.utcnow(),
        file_path=chart_path 
    )
    session.add(analysis)
    session.commit()
    session.refresh(analysis)
    
    return analysis

@router.post("/{symbol}/refresh_financials", response_model=Stock)
def refresh_financials(symbol: str, session: Session = Depends(get_session)):
    stock = session.get(Stock, symbol)
    if not stock:
         raise HTTPException(status_code=404, detail="Stock not found")
    
    # Fetch from service
    metrics = None
    try:
        metrics = stock_service.fetch_fundamentals(symbol)
    except Exception as e:
        print(f"Error fetching fundamentals for {symbol}: {e}")

    if metrics:
        # Update Fields
        # metrics keys should match Stock fields or be mapped
        for key, val in metrics.items():
            if hasattr(stock, key) and val is not None:
                 setattr(stock, key, val)
    else:
        print(f"No fundamentals found for {symbol}")
             
    stock.updated_at = datetime.utcnow()
    session.add(stock)
    session.commit()
    session.refresh(stock)

    # --- Financial History Sync ---
    try:
        history_data = stock_service.fetch_financial_history(symbol)
        if history_data:
            for rec in history_data:
                # Upsert
                stmt = select(StockFinancials).where(
                    StockFinancials.symbol == symbol,
                    StockFinancials.report_date == rec['date'],
                    StockFinancials.period == rec['period']
                )
                existing = session.exec(stmt).first()
                if existing:
                    existing.revenue = rec['revenue']
                    existing.net_income = rec['net_income']
                    existing.eps = rec['eps']
                    session.add(existing)
                else:
                    new_rec = StockFinancials(
                        symbol=symbol,
                        report_date=rec['date'], # Map date -> report_date
                        period=rec['period'],
                        revenue=rec['revenue'],
                        net_income=rec['net_income'],
                        eps=rec['eps']
                    )
                    session.add(new_rec)
            session.commit()
    except Exception as e:
        print(f"Error syncing financial history: {e}")
        # Non-blocking, return stock anyway
    
    session.refresh(stock)
    return stock

@router.get("/{symbol}/financials", response_model=List[StockFinancials])
def get_stock_financials(symbol: str, session: Session = Depends(get_session)):
    query = select(StockFinancials).where(StockFinancials.symbol == symbol).order_by(StockFinancials.report_date.asc())
    results = session.exec(query).all()
    return results

@router.get("/{symbol}/news", response_model=List[StockNews])
def get_stock_news(symbol: str, session: Session = Depends(get_session)):
    # 1. Check DB for recent news (e.g. < 24h old?)
    # For simplicity, just get latest 20. If empty, fetch.
    # User might want "Force Refresh" button for news too? 
    # Let's auto-fetch if empty or very old.
    
    # Get stored news
    news_items = session.exec(select(StockNews).where(StockNews.symbol == symbol).order_by(StockNews.provider_publish_time.desc()).limit(50)).all()
    
    should_fetch = False
    if not news_items:
        should_fetch = True
    else:
        # Check staleness - if latest news is older than 6 hours?
        latest = news_items[0].provider_publish_time
        if (datetime.utcnow() - latest).total_seconds() > 6 * 3600:
            should_fetch = True
            
    if should_fetch:
        print(f"Fetching fresh news for {symbol}")
        fetched = stock_service.fetch_news(symbol)
        if fetched:
             # Save to DB (deduplicate by link)
             # First, get all links that we are about to insert to check against DB
             fetched_links = [item['link'] for item in fetched]
             
             # Query existing links from DB (only those that match fetched)
             # SQLite limit variable number? split if too many? 
             # fetched is usually small (e.g. 10-20 items).
             
             stmt = select(StockNews.link).where(StockNews.link.in_(fetched_links))
             existing_db_links = set(session.exec(stmt).all())
             
             new_count = 0
             for item in fetched:
                 if item['link'] not in existing_db_links:
                     news_obj = StockNews(
                         symbol=symbol,
                         title=item['title'],
                         publisher=item['publisher'],
                         link=item['link'],
                         provider_publish_time=item['provider_publish_time'],
                         type=item['type'],
                         thumbnail_url=item['thumbnail_url'],
                         related_tickers_json=json.dumps(item['related_tickers'])
                     )
                     session.add(news_obj)
                     # Add to set to prevent duplicates within the batch itself
                     existing_db_links.add(item['link'])
                     new_count += 1
             
             if new_count > 0:
                 session.commit()
                 # Re-fetch sorted
                 news_items = session.exec(select(StockNews).where(StockNews.symbol == symbol).order_by(StockNews.provider_publish_time.desc()).limit(50)).all()
                 
    return news_items
