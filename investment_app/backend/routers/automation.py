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
@router.post("/import/files")
def import_files(request: FileImportRequest):
    """Import Finviz/IBD files or Moomoo CSVs synchronously"""
    print(f"[Automation Router] Received import request: {request.file_paths}")
    
    finviz_files = []
    moomoo_files = []
    
    for p in request.file_paths:
        p = p.strip('"').strip("'")
        print(f"[Automation Router] Processing path: {p}")
        if "履歴" in p or "moomoo" in p.lower():
            moomoo_files.append(p)
        else:
            finviz_files.append(p)
    
    print(f"[Automation Router] Finviz: {finviz_files}, Moomoo: {moomoo_files}")
    
    # Run synchronously so frontend waits
    result = run_import_task(finviz_files, moomoo_files)
    
    return {"status": "Import completed", "added_stocks": result.get('added', [])}

def run_import_task(finviz_files, moomoo_files):
    result = {'count': 0, 'added': []}
    if finviz_files:
        res = importer.import_finviz_ibd_files(finviz_files)
        if isinstance(res, int): # Legacy fallback just in case
             result['count'] += res
        elif isinstance(res, dict):
             result['count'] += res.get('count', 0)
             result['added'].extend(res.get('added', []))

    for m in moomoo_files:
        # Moomoo import currently only returns count, logic can be updated later if needed
        # For now just add count
        count = importer.import_moomoo_csv(m)
        result['count'] += count
    
    return result

@router.post("/refresh-data/{symbol}")
def refresh_stock_data(symbol: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(stock_service.get_stock_data, symbol, force_refresh=True)
    return {"status": f"Refresh started for {symbol}"}
