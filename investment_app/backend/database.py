from sqlmodel import SQLModel, create_engine, Field, Session
from typing import Optional
from datetime import datetime

import os

# Database Connection
sqlite_file_name = "investment_app.db"
# Use absolute path to avoid CWD issues
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# current: .../investment_app/backend/database.py
# target: .../investment_app/../data/investment_app.db? 
# Wait, existing was "../data". Relative to CWD.
# Backend runs in "investment_app". "../data" -> "StockAnalysis/data".
# So from database.py (backend), we need to go up to investment_app -> up to StockAnalysis -> down to data.
# database.py is in backend.
# os.path.dirname(__file__) = .../backend
# up 1 = .../investment_app
# up 2 = .../StockAnalysis
# target = .../StockAnalysis/data
# Path: os.path.join(BASE_DIR, "..", "..", "data", sqlite_file_name)

# Actually, let's check where the data folder is.
# list_dir(StockAnalysis) -> "data".
# So "StockAnalysis/data".
# database.py is in "StockAnalysis/investment_app/backend/database.py".
# So:
# backend (BASE_DIR)
# .. -> investment_app
# .. -> StockAnalysis
# data -> StockAnalysis/data

DATA_DIR = os.path.join(BASE_DIR, "..", "..", "data")
DATA_DIR = os.path.abspath(DATA_DIR)
sqlite_url = f"sqlite:///{os.path.join(DATA_DIR, sqlite_file_name)}"
print(f"DEBUG: SQLite URL: {sqlite_url}")

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

# Models (Preliminary)
class Stock(SQLModel, table=True):
    symbol: str = Field(primary_key=True)
    company_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None
    change_percentage_1d: Optional[float] = None
    change_percentage_5d: Optional[float] = None
    change_percentage_20d: Optional[float] = None
    change_percentage_50d: Optional[float] = None

    change_percentage_200d: Optional[float] = None
    
    # SMA Deviations
    deviation_5ma_pct: Optional[float] = None
    deviation_20ma_pct: Optional[float] = None
    deviation_50ma_pct: Optional[float] = None
    deviation_200ma_pct: Optional[float] = None

    # MA Slopes (Daily Change)
    slope_5ma: Optional[float] = None
    slope_20ma: Optional[float] = None
    slope_50ma: Optional[float] = None
    slope_200ma: Optional[float] = None

    # Price & Relative Strength
    current_price: Optional[float] = None
    rs_5d: Optional[float] = None
    rs_20d: Optional[float] = None
    rs_50d: Optional[float] = None
    rs_200d: Optional[float] = None

    is_in_uptrend: Optional[bool] = Field(default=False)
    asset_type: Optional[str] = Field(default="stock") # stock, index
    
    # Chart Data
    daily_chart_data: Optional[str] = Field(default=None) # JSON list of OHLCV
    
    # IBD Ratings
    composite_rating: Optional[int] = Field(default=None)
    rs_rating: Optional[int] = Field(default=None)
    ibd_rating_date: Optional[datetime] = Field(default=None)
    atr_14: Optional[float] = Field(default=None)
    
    # Signals
    signal_higher_200ma: Optional[int] = Field(default=0)
    signal_near_200ma: Optional[int] = Field(default=0)
    signal_over_50ma: Optional[int] = Field(default=0)
    signal_higher_50ma_than_200ma: Optional[int] = Field(default=0)
    signal_uptrand_200ma: Optional[int] = Field(default=0)
    signal_sameslope_50_200: Optional[int] = Field(default=0)
    signal_newhigh: Optional[int] = Field(default=0)
    signal_newhigh_200days: Optional[int] = Field(default=0)
    signal_newhigh_100days: Optional[int] = Field(default=0)
    signal_newhigh_50days: Optional[int] = Field(default=0)
    signal_high_volume: Optional[int] = Field(default=0)
    signal_price_up: Optional[int] = Field(default=0)
    signal_break_atr: Optional[int] = Field(default=0)
    signal_high_slope5ma: Optional[int] = Field(default=0)
    signal_rebound_5ma: Optional[int] = Field(default=0)

    first_import_date: Optional[datetime] = Field(default=None)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class SavedFilter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    criteria_json: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TradeHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True)
    trade_type: str # Buy/Sell
    quantity: float
    price: float
    trade_date: datetime
    # Moomoo specific fields
    system_fee: Optional[float] = None
    tax: Optional[float] = None
    total_amount: Optional[float] = None

class AnalysisResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True)
    content: str # Markdown content
    created_at: datetime = Field(default_factory=datetime.utcnow)
    file_path: Optional[str] = None

class StockNote(SQLModel, table=True):
    symbol: str = Field(primary_key=True)
    content: str = "" # User notes
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GeminiPrompt(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TableViewConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    columns_json: str # JSON list of column keys
    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
