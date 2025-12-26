
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import logging

from ..database import get_session, StockAlert, Stock

router = APIRouter(
    prefix="/alerts",
    tags=["alerts"]
)

@router.get("/", response_model=List[StockAlert])
def list_alerts(
    session: Session = Depends(get_session)
):
    """List all alerts"""
    return session.exec(select(StockAlert)).all()

@router.post("/", response_model=StockAlert)
def create_alert(
    alert: StockAlert,
    session: Session = Depends(get_session)
):
    """Create a new alert"""
    alert.created_at = datetime.utcnow()
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert

@router.put("/{alert_id}", response_model=StockAlert)
def update_alert(
    alert_id: int,
    alert_update: StockAlert,
    session: Session = Depends(get_session)
):
    """Update an existing alert"""
    db_alert = session.get(StockAlert, alert_id)
    if not db_alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert_data = alert_update.dict(exclude_unset=True)
    for key, value in alert_data.items():
        setattr(db_alert, key, value)
        
    session.add(db_alert)
    session.commit()
    session.refresh(db_alert)
    return db_alert

@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    session: Session = Depends(get_session)
):
    """Delete an alert"""
    alert = session.get(StockAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    session.delete(alert)
    session.commit()
    return {"ok": True}

@router.post("/check")
def check_alerts(
    session: Session = Depends(get_session)
):
    """
    Check all active alerts against current stock data.
    Returns the list of triggered alerts.
    """
    alerts = session.exec(select(StockAlert).where(StockAlert.is_active == True)).all()
    triggered_alerts = []
    
    for alert in alerts:
        stock = session.get(Stock, alert.symbol)
        if not stock:
            continue
            
        try:
            # Parse Stages
            stages = []
            if alert.stages_json:
                stages = json.loads(alert.stages_json)
            
            # Fallback to condition_json if stages empty (legacy support)
            if not stages and alert.condition_json:
                stages = [json.loads(alert.condition_json)]

            if not stages:
                continue

            current_idx = alert.current_stage_index
            if current_idx >= len(stages):
                 # Already finished? Reset or ignore?
                 # If we want to allow re-triggering, maybe reset to 0 after triggering?
                 # For now, let's assume if it's active and index is out of bounds, reset to 0 to restart cycle
                 current_idx = 0
                 alert.current_stage_index = 0

            target_conditions = stages[current_idx]
            
            # Check conditions for current stage
            is_stage_met = True
            for cond in target_conditions:
                metric = cond.get("metric")
                op = cond.get("op")
                val = cond.get("value")
                
                stock_val = getattr(stock, metric, None)
                if stock_val is None:
                    is_stage_met = False
                    break
                
                try:
                    s_val = float(stock_val)
                    t_val = float(val)
                    
                    if op == "gte":
                        if not (s_val >= t_val): is_stage_met = False
                    elif op == "lte":
                        if not (s_val <= t_val): is_stage_met = False
                    elif op == "eq":
                        if s_val != t_val: is_stage_met = False
                except:
                    is_stage_met = False
                
                if not is_stage_met:
                    break
            
            if is_stage_met:
                # Stage Completed
                # If Last Stage -> Trigger
                if current_idx == len(stages) - 1:
                    alert.triggered = True
                    alert.last_triggered_at = datetime.utcnow()
                    alert.current_stage_index = 0 # Reset for next cycle? Or keep at max? 
                    # User request: "last stage met -> alert is active". 
                    # Usually alerts fire once. Let's restart cycle to allow re-firing.
                    triggered_alerts.append(alert)
                else:
                    # Advance to next stage
                    alert.current_stage_index += 1
                    alert.triggered = False # ensuring
            else:
                # Condition not met for current stage
                # If we are in middle of stage (idx > 0), do we reset? 
                # User's example: "Stage 1 (Slope < 10) -> Stage 2 (Slope > 10)".
                # If Stage 1 met, we wait for Stage 2. If Stage 2 is NOT met yet, we keep waiting.
                # Strictly sequential. We do NOT reset to 0 if Stage 2 fails. We simply haven't reached Stage 2 yet.
                pass
                
            session.add(alert)
            
        except Exception as e:
            logging.error(f"Error checking alert {alert.id}: {e}")
            
    session.commit()
    return triggered_alerts
