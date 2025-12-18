from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from typing import List
from ..services.automation_service import automation_service

router = APIRouter(
    prefix="/automation/research",
    tags=["automation"],
    responses={404: {"description": "Not found"}},
)

class StartResearchRequest(BaseModel):
    symbols: List[str]
    prompt_id: int
    prompt_content: str 

@router.post("/start")
async def start_research(request: StartResearchRequest):
    result = automation_service.start_research(request.symbols, request.prompt_content)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.post("/stop")
async def stop_research():
    return automation_service.stop_research()

@router.get("/status")
async def get_status():
    return automation_service.get_status()
