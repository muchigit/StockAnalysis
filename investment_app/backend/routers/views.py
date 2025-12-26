from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from sqlmodel import Session, select
from ..database import engine, TableViewConfig
from pydantic import BaseModel

router = APIRouter(prefix="/views", tags=["views"])

class ViewConfigCreate(BaseModel):
    name: str
    view_type: str = "dashboard"
    columns_json: str
    is_default: Optional[bool] = False

class ViewConfigUpdate(BaseModel):
    name: Optional[str] = None
    view_type: Optional[str] = None
    columns_json: Optional[str] = None
    is_default: Optional[bool] = None

@router.get("/", response_model=List[TableViewConfig])
def get_views(view_type: str = Query("dashboard")):
    with Session(engine) as session:
        return session.exec(select(TableViewConfig).where(TableViewConfig.view_type == view_type)).all()

@router.post("/", response_model=TableViewConfig)
def create_view(config: ViewConfigCreate):
    with Session(engine) as session:
        # Check if name exists within the same view_type
        existing = session.exec(select(TableViewConfig).where(
            TableViewConfig.name == config.name,
            TableViewConfig.view_type == config.view_type
        )).first()
        
        if existing:
            # Update existing
            existing.columns_json = config.columns_json
            existing.is_default = config.is_default
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing
        else:
            new_view = TableViewConfig(
                name=config.name, 
                view_type=config.view_type,
                columns_json=config.columns_json, 
                is_default=config.is_default
            )
            session.add(new_view)
            session.commit()
            session.refresh(new_view)
            return new_view

@router.put("/{view_id}", response_model=TableViewConfig)
def update_view(view_id: int, config: ViewConfigUpdate):
    with Session(engine) as session:
        view = session.get(TableViewConfig, view_id)
        if not view:
            raise HTTPException(status_code=404, detail="View not found")
        
        if config.name is not None:
            view.name = config.name
        if config.columns_json is not None:
            view.columns_json = config.columns_json
        if config.is_default is not None:
            view.is_default = config.is_default
            
        session.add(view)
        session.commit()
        session.refresh(view)
        return view

@router.delete("/{view_id}")
def delete_view(view_id: int):
    with Session(engine) as session:
        view = session.get(TableViewConfig, view_id)
        if not view:
            raise HTTPException(status_code=404, detail="View not found")
        session.delete(view)
        session.commit()
        return {"status": "deleted"}
