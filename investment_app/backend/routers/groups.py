from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime
from ..database import get_session, StockGroup, StockGroupMember, Stock

router = APIRouter(prefix="/groups", tags=["groups"])

# --- Group CRUD ---

@router.get("/", response_model=List[StockGroup])
def list_groups(session: Session = Depends(get_session)):
    groups = session.exec(select(StockGroup)).all()
    return groups

@router.post("/", response_model=StockGroup)
def create_group(group: StockGroup, session: Session = Depends(get_session)):
    # Check duplicate name
    existing = session.exec(select(StockGroup).where(StockGroup.name == group.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group with this name already exists")
    
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.delete("/{group_id}")
def delete_group(group_id: int, session: Session = Depends(get_session)):
    group = session.get(StockGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    # Delete members first (cascade usually handles this but excessive manual safety)
    members = session.exec(select(StockGroupMember).where(StockGroupMember.group_id == group_id)).all()
    for m in members:
        session.delete(m)
        
    session.delete(group)
    session.commit()
    return {"status": "deleted", "id": group_id}

# --- Member Management ---

@router.get("/{group_id}/members", response_model=List[Stock])
def list_group_members(group_id: int, session: Session = Depends(get_session)):
    # Verify group exists
    group = session.get(StockGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    # Join Member -> Stock
    # Ideally: Select Stock where Stock.symbol in (Select symbol from Member where group_id = ID)
    statement = select(Stock).join(StockGroupMember, Stock.symbol == StockGroupMember.symbol).where(StockGroupMember.group_id == group_id)
    stocks = session.exec(statement).all()
    return stocks

@router.post("/{group_id}/members", response_model=StockGroupMember)
def add_member(group_id: int, symbol: str, session: Session = Depends(get_session)):
    group = session.get(StockGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    # Check if stock exists (optional, but good practice)
    # stock = session.get(Stock, symbol)
    # if not stock:
    #     raise HTTPException(status_code=404, detail="Stock not found")

    # Check duplicate
    existing = session.exec(select(StockGroupMember).where(StockGroupMember.group_id == group_id, StockGroupMember.symbol == symbol)).first()
    if existing:
        return existing # Already added, idempotent success
        
    member = StockGroupMember(group_id=group_id, symbol=symbol)
    session.add(member)
    try:
        session.commit()
        session.refresh(member)
        return member
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{group_id}/members/{symbol}")
def remove_member(group_id: int, symbol: str, session: Session = Depends(get_session)):
    member = session.exec(select(StockGroupMember).where(StockGroupMember.group_id == group_id, StockGroupMember.symbol == symbol)).first()
    if not member:
         raise HTTPException(status_code=404, detail="Member not found in group")
         
    session.delete(member)
    session.commit()
    return {"status": "removed", "group_id": group_id, "symbol": symbol}
