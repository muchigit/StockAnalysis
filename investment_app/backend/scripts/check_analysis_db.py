
from sqlmodel import Session, select, create_engine
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'investment_app', 'backend'))
from database import Stock, AnalysisResult, sqlite_url

def check_analysis():
    engine = create_engine(sqlite_url)
    with Session(engine) as session:
        # Check if any analysis exists
        analyses = session.exec(select(AnalysisResult).limit(5)).all()
        print(f"Total analyses found (limit 5): {len(analyses)}")
        for a in analyses:
            print(f"Symbol: {a.symbol}, Date: {a.created_at}, Content Preview: {a.content[:20]}")

if __name__ == "__main__":
    check_analysis()
