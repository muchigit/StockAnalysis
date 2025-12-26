from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from sqlmodel import Session, select
from datetime import date, datetime, timedelta
from ..database import get_session, Stock

router = APIRouter(prefix="/calendar", tags=["calendar"])

@router.get("/earnings")
def get_earnings_calendar(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    session: Session = Depends(get_session)
):
    # Query stocks where next_earnings_date is between start and end
    # Note: next_earnings_date might be null for some.
    
    # Simple query
    statement = select(Stock).where(
        Stock.next_earnings_date >= start_date,
        Stock.next_earnings_date <= end_date
    )
    stocks = session.exec(statement).all()
    
    # Return simplified list
    response = []
    for s in stocks:
        response.append({
            "symbol": s.symbol,
            "company_name": s.company_name,
            "earnings_date": s.next_earnings_date,
            "market_cap": s.market_cap,
            "sector": s.sector
        })
        
    return response
