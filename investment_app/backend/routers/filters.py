from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from ..database import get_session, SavedFilter
from pydantic import BaseModel

router = APIRouter(prefix="/filters", tags=["filters"])

class FilterCreate(BaseModel):
    name: str
    criteria_json: str

@router.get("/", response_model=List[SavedFilter])
def list_filters(session: Session = Depends(get_session)):
    return session.exec(select(SavedFilter).order_by(SavedFilter.created_at.desc())).all()

@router.post("/", response_model=SavedFilter)
def create_filter(filter_data: FilterCreate, session: Session = Depends(get_session)):
    db_filter = SavedFilter(name=filter_data.name, criteria_json=filter_data.criteria_json)
    session.add(db_filter)
    session.commit()
    session.refresh(db_filter)
    return db_filter

@router.delete("/{filter_id}")
def delete_filter(filter_id: int, session: Session = Depends(get_session)):
    filter_obj = session.get(SavedFilter, filter_id)
    if not filter_obj:
        raise HTTPException(status_code=404, detail="Filter not found")
    session.delete(filter_obj)
    session.commit()
    return {"ok": True}

class FilterUpdate(BaseModel):
    name: str | None = None
    criteria_json: str | None = None

@router.put("/{filter_id}", response_model=SavedFilter)
def update_filter(filter_id: int, filter_update: FilterUpdate, session: Session = Depends(get_session)):
    db_filter = session.get(SavedFilter, filter_id)
    if not db_filter:
        raise HTTPException(status_code=404, detail="Filter not found")
    
    if filter_update.name is not None:
        db_filter.name = filter_update.name
    if filter_update.criteria_json is not None:
        db_filter.criteria_json = filter_update.criteria_json
    
    session.add(db_filter)
    session.commit()
    session.refresh(db_filter)
    return db_filter
