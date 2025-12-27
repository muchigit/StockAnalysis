from typing import Optional
from .database import Stock

class StockResponse(Stock):
    holding_quantity: float = 0.0
    trade_count: int = 0
    status: str = "None" # "Holding", "Past Trade", "None"
    last_buy_date: Optional[str] = None
    last_sell_date: Optional[str] = None
    realized_pl: Optional[float] = 0.0
    unrealized_pl: Optional[float] = 0.0
    average_cost: Optional[float] = 0.0
    note: Optional[str] = None
    latest_analysis: Optional[str] = None
