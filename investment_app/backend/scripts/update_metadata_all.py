from sqlmodel import Session, select
from investment_app.backend.database import engine, Stock
from investment_app.backend.services.stock_service import stock_service
import time

def update_metadata():
    with Session(engine) as session:
        # Select all stocks
        stocks = session.exec(select(Stock)).all()
        print(f"Total stocks: {len(stocks)}")
        
        updated_count = 0
        
        for stock in stocks:
            if not stock.sector or stock.sector == 'Unknown':
                try:
                    print(f"Updating metadata for {stock.symbol}...")
                    info = stock_service.get_stock_info(stock.symbol)
                    if info:
                        sector = info.get('sector')
                        industry = info.get('industry')
                        company_name = info.get('longName') or info.get('shortName')
                        
                        if sector:
                            stock.sector = sector
                        if industry:
                            stock.industry = industry
                        # Optional: Update Name if missing or keep imported one?
                        # Keep imported one usually, but if imported was null...
                        if not stock.company_name and company_name:
                            stock.company_name = company_name

                        session.add(stock)
                        updated_count += 1
                        
                        if updated_count % 10 == 0:
                            session.commit()
                            print(f"Committed {updated_count} updates...")
                            
                except Exception as e:
                    print(f"Error updating {stock.symbol}: {e}")
                
                # Sleep to be nice to API
                time.sleep(0.5)
        
        session.commit()
        print(f"Finished. Updated {updated_count} stocks.")

if __name__ == "__main__":
    update_metadata()
