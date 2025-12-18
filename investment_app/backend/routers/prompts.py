from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from datetime import datetime
from ..database import get_session, GeminiPrompt

router = APIRouter(
    prefix="/prompts",
    tags=["prompts"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[GeminiPrompt])
async def read_prompts(session: Session = Depends(get_session)):
    prompts = session.exec(select(GeminiPrompt)).all()
    return prompts

@router.post("/", response_model=GeminiPrompt)
async def create_prompt(prompt: GeminiPrompt, session: Session = Depends(get_session)):
    prompt.created_at = datetime.utcnow()
    prompt.updated_at = datetime.utcnow()
    session.add(prompt)
    session.commit()
    session.refresh(prompt)
    return prompt

@router.put("/{prompt_id}", response_model=GeminiPrompt)
async def update_prompt(prompt_id: int, prompt_data: GeminiPrompt, session: Session = Depends(get_session)):
    prompt = session.get(GeminiPrompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    prompt.name = prompt_data.name
    prompt.content = prompt_data.content
    prompt.updated_at = datetime.utcnow()
    
    session.add(prompt)
    session.commit()
    session.refresh(prompt)
    return prompt

@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: int, session: Session = Depends(get_session)):
    prompt = session.get(GeminiPrompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    session.delete(prompt)
    session.commit()
    return {"ok": True}
