
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.services.moomoo_service import moomoo_service

router = APIRouter(prefix="/trading", tags=["trading"])

class UnlockRequest(BaseModel):
    password: str

class OrderRequest(BaseModel):
    symbol: str
    side: str
    qty: float
    order_type: str = "NORMAL" # NORMAL, MARKET, STOP, STOP_LIMIT...
    price: Optional[float] = None
    stop_price: Optional[float] = None # For Stop/StopLimit trigger
    
    # Advanced / Simultaneous
    stop_loss_enabled: bool = False
    stop_loss_price: Optional[float] = None
    
    # Trailing
    trail_type: Optional[str] = None # 'RATIO' or 'AMOUNT'
    trail_value: Optional[float] = None
    trail_spread: Optional[float] = None

    # Other
    time_in_force: str = "DAY"
    fill_outside_rth: bool = False

@router.post("/unlock")
def unlock_trade(req: UnlockRequest):
    success, msg = moomoo_service.unlock_trade(req.password)
    if not success:
        return {"status": "error", "message": msg}
    return {"status": "success", "message": "Trading unlocked"}

@router.get("/account")
def get_account():
    data = moomoo_service.get_account_info()
    if data is None:
        raise HTTPException(status_code=500, detail="Failed to get account info. Make sure OpenD is running and unlocked.")
    return data

@router.post("/order")
def place_order(req: OrderRequest):
    # 1. Place Primary Order
    result = moomoo_service.place_order(
        symbol=req.symbol,
        side=req.side,
        qty=req.qty,
        price=req.price,
        order_type=req.order_type,
        stop_price=req.stop_price,
        trail_type=req.trail_type,
        trail_value=req.trail_value,
        trail_spread=req.trail_spread,
        fill_outside_rth=req.fill_outside_rth,
        time_in_force=req.time_in_force
    )
    
    if result["status"] == "error":
        return result
    
    response_msg = f"Order {result['order_id']} placed."
    primary_order_id = result['order_id']
    
    # 2. Place Simultaneous Stop Loss (if requested and side is BUY)
    stop_loss_result = None
    if req.side.upper() == "BUY" and req.stop_loss_enabled and req.stop_loss_price:
        # Stop Loss is a SELL STOP order
        sl_result = moomoo_service.place_order(
            symbol=req.symbol,
            side="SELL",
            qty=req.qty, # Same qty
            order_type="STOP",
            stop_price=req.stop_loss_price,
            price=None, # Market if touched
            time_in_force="GTC", # Usually GTC for protection
            fill_outside_rth=True # Protect in extended hours?
        )
        if sl_result["status"] == "success":
            response_msg += f" Stop Loss Order {sl_result['order_id']} placed."
        else:
            response_msg += f" WARNING: Stop Loss Order FAILED: {sl_result['msg']}"
            
    return {"status": "success", "message": response_msg, "order_id": primary_order_id}
