from fastapi import APIRouter
from ..services.update_manager import update_manager

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/status")
def get_system_status():
    return update_manager.get_status()

@router.post("/update/start")
def start_update():
    started = update_manager.start_update()
    if started:
        return {"status": "started"}
    else:
        return {"status": "already_running"}

from pydantic import BaseModel
import os

class OpenFileRequest(BaseModel):
    path: str

@router.post("/open_file")
def open_file(request: OpenFileRequest):
    if not os.path.exists(request.path):
        return {"status": "error", "message": "File not found"}
    
    try:
        os.startfile(request.path)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
