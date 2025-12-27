from ..database import Stock, StockFinancials, StockNews, Session, engine
from sqlmodel import select
from .stock_service import stock_service
from .gemini_service import gemini_service
import logging
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

def run_nightly_cycle():
    """
    Called every minute between 2:00 and 5:00 AM.
    Executes one small task per call to distribute load.
    """
    with Session(engine) as session:
        # Prioritize Financials (essential data)
        if _run_financials_task(session):
            return

        # Then News Summary (enrichment)
        if _run_news_summary_task(session):
            return

def _run_financials_task(session: Session) -> bool:
    """
    Check for stocks missing financials.
    Returns True if a task was executed.
    """
    # Find stocks present in Stock but missing in StockFinancials
    # SQLModel doesn't support NOT IN subquery easily in pythonic way, use raw SQL or loop?
    # Or just select * from Stock and checking (slow for strict check).
    # Better: Join with isouter=True and check null.
    
    # Simple strategy: Select stocks updated recently (active) but missing financials? 
    # Or just any stock. Let's just try to find one.
    
    # Get all symbols (cached if possible, but db query is fine for small db)
    # Optimized: SELECT s.symbol FROM stock s LEFT JOIN stockfinancials f ON s.symbol = f.symbol WHERE f.symbol IS NULL LIMIT 1
    
    from sqlmodel import text
    statement = text("SELECT symbol FROM stock WHERE symbol NOT IN (SELECT symbol FROM stockfinancials) LIMIT 1")
    result = session.exec(statement).first()
    
    if result:
        symbol = result[0]
        logger.info(f"[Scheduled] Fetching missing financials for {symbol}")
        try:
            # Note: get_financials was hypothetical, stock_service usually has fetch_fundamentals and fetch_financial_history
            # The router uses refresh_financials logic which calls fetch_fundamentals AND fetch_financial_history.
            # We should replicate that or call a unified method.
            # Let's call fetch_fundamentals AND fetch_financial_history.
            
            # 1. Fundamentals (Market Cap etc)
            stock_service.fetch_fundamentals(symbol)
             # Update Stock table? fetch_fundamentals returns dict. 
             # We need to save it. 
             # Since this function is lightweight, let's just use the router logic approach logic here?
             # Or better: Just call fetch_financial_history which saves to StockFinancials, satisfying the NOT IN check.
            
            stock_service.fetch_financial_history(symbol)
            # The fetch_financial_history returns data, doesn't save it effectively to DB unless we do it here.
            # Wait, stock_service methods generally RETURN data, they don't save to DB (Service pattern usually pure?).
            # In router `refresh_financials`:
            #   metrics = stock_service.fetch_fundamentals(symbol)
            #   update stock object...
            #   history = stock_service.fetch_financial_history(symbol)
            #   upsert StockFinancials...
            
            # I must IMPLEMENT the saving logic here.
            
            # A. Fundamentals
            metrics = stock_service.fetch_fundamentals(symbol)
            stock = session.get(Stock, symbol)
            if stock and metrics:
                 for key, val in metrics.items():
                    if hasattr(stock, key) and val is not None:
                        setattr(stock, key, val)
                 stock.updated_at = datetime.utcnow()
                 session.add(stock)

            # B. History
            history_data = stock_service.fetch_financial_history(symbol)
            if history_data:
                for rec in history_data:
                    from ..database import StockFinancials
                    # Upsert logic
                    # Check existing?
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
                            report_date=rec['date'],
                            period=rec['period'],
                            revenue=rec['revenue'],
                            net_income=rec['net_income'],
                            eps=rec['eps']
                        )
                        session.add(new_rec)
            
            session.commit()
            return True
            
        except Exception as e:
            logger.error(f"[Scheduled] Error fetching financials for {symbol}: {e}")
            return False
            
    return False

def _run_news_summary_task(session: Session) -> bool:
    """
    Check for stocks missing news summary.
    Returns True if a task was executed.
    """
    statement = select(Stock).where(Stock.news_summary_jp == None).limit(1)
    results = session.exec(statement).all()
    
    if not results:
        return False
        
    stock = results[0]
    symbol = stock.symbol
    
    logger.info(f"[Scheduled] Generating news summary for {symbol}")
    
    try:
        # 1. Fetch News
        news_items = stock_service.fetch_news(symbol)
        
        if not news_items:
            stock.news_summary_jp = "ニュースなし"
            session.add(stock)
            session.commit()
            return True
            
        # 2. Generate Summary
        # news_items is list of dicts. Keys match stock_service return.
        # provider_publish_time might be datetime or string.
        news_text = "\n".join([f"- {item.get('title')} ({item.get('provider_publish_time', '')})" for item in news_items[:10]])
        
        prompt = f"""
以下の銘柄の最新ニュースを基に、市場のセンチメントと重要な出来事を日本語で要約してください。
銘柄: {symbol}

【ニュース一覧】
{news_text}

【制約】
- 日本語で出力すること
- 300文字以内で簡潔にまとめること
- 投資家にとって重要な情報を優先すること
- "ニュースによると"などの前置きは省略し、要点から始めること
- 追加の提案は不要です
"""
        summary = gemini_service.generate_content(prompt)
        
        # 3. Save
        stock.news_summary_jp = summary
        session.add(stock)
        session.commit()
        logger.info(f"[Scheduled] Summary generated for {symbol}")
        return True
        
    except Exception as e:
        logger.error(f"[Scheduled] Error summarizing news for {symbol}: {e}")
        return False
