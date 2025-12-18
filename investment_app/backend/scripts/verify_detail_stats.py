
import sys
import os
from sqlmodel import Session, create_engine, select

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'investment_app', 'backend'))
from database import Stock, TradeHistory, sqlite_url
from routers.stocks import _calculate_stats

def verify_stats():
    engine = create_engine(sqlite_url)
    with Session(engine) as session:
        # Find a stock with trades
        trade = session.exec(select(TradeHistory).limit(1)).first()
        if not trade:
            print("No trades found in DB to test.")
            return

        symbol = trade.symbol
        print(f"Testing stats for symbol: {symbol}")
        
        trades = session.exec(select(TradeHistory).where(TradeHistory.symbol == symbol).order_by(TradeHistory.trade_date.asc())).all()
        stats_map = _calculate_stats(trades)
        stats = stats_map.get(symbol)
        
        print("Calculated Stats:")
        print(f"Qty: {stats['qty']}")
        print(f"Count: {stats['cnt']}")
        print(f"Realized PL: {stats['realized_pl']}")
        print(f"Last Buy: {stats['last_buy']}")
        print(f"Last Sell: {stats['last_sell']}")

if __name__ == "__main__":
    verify_stats()
