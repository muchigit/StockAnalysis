from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import List
from ..services.importer import importer
from ..services.stock_service import stock_service
from ..services.gemini_service import gemini_service
from ..database import get_session, TradeHistory, Stock
from sqlmodel import Session, select
from fastapi import Depends

router = APIRouter(prefix="/automation", tags=["automation"])

class AnalyzeRequest(BaseModel):
    symbol: str
    prompt: str

@router.post("/analyze")
def analyze_stock(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Trigger Gemini Deep Research"""
    # Run in background
    background_tasks.add_task(gemini_service.analyze_stock, request.symbol, request.prompt)
    return {"status": "Analysis started", "symbol": request.symbol}


class FileImportRequest(BaseModel):
    file_paths: List[str]

@router.post("/import/files")
def import_files(request: FileImportRequest):
    """Import Finviz/IBD files or Moomoo CSVs synchronously"""
    
    finviz_files = []
    moomoo_files = []
    
    for p in request.file_paths:
        p = p.strip('"').strip("'")
        if "履歴" in p or "moomoo" in p.lower():
            moomoo_files.append(p)
        else:
            finviz_files.append(p)
            
    # Run synchronously so frontend waits
    run_import_task(finviz_files, moomoo_files)
    
    return {"status": "Import completed"}

def run_import_task(finviz_files, moomoo_files):
    if finviz_files:
        importer.import_finviz_ibd_files(finviz_files)
    for m in moomoo_files:
        importer.import_moomoo_csv(m)

@router.post("/refresh-data/{symbol}")
def refresh_stock_data(symbol: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(stock_service.get_stock_data, symbol, force_refresh=True)
    return {"status": f"Refresh started for {symbol}"}
