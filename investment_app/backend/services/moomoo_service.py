
import logging
from futu import *
import threading
import time
import hashlib

logger = logging.getLogger(__name__)

class MoomooService:
    def __init__(self, host='127.0.0.1', port=11111):
        self.host = host
        self.port = port
        self.ctx = None
        self.lock = threading.Lock()
        self.is_connected = False

    def connect(self):
        """Initializes the connection to FutuOpenD."""
        with self.lock:
            if self.is_connected:
                return True
            try:
                # SecurityFirm.FUTUINC for US, FUTUSECURITIES for HK. 
                # Assuming US account as per request.
                self.ctx = OpenSecTradeContext(
                    filter_trdmarket=TrdMarket.US,
                    host=self.host,
                    port=self.port,
                    security_firm=SecurityFirm.FUTUINC
                )
                self.is_connected = True
                logger.info(f"Connected to Moomoo OpenD at {self.host}:{self.port}")
                return True
            except Exception as e:
                logger.error(f"Failed to connect to Moomoo OpenD: {e}")
                self.is_connected = False
                return False

    def close(self):
        if self.ctx:
            self.ctx.close()
            self.is_connected = False

    def unlock_trade(self, password):
        """Unlocks trading with MD5 password."""
        if not self.connect():
            return False, "Not connected to OpenD"
        
        try:
            md5_pwd = hashlib.md5(password.encode('utf-8')).hexdigest()
            ret_code, data = self.ctx.unlock_trade(password_md5=md5_pwd, is_unlock=True)
            if ret_code == RET_OK:
                return True, "Success"
            else:
                return False, f"Unlock failed: {data}"
        except Exception as e:
            return False, str(e)

    def get_account_info(self):
        if not self.connect():
            return None
        try:
            ret, data = self.ctx.accinfo_query(trd_env=TrdEnv.REAL)
            if ret == RET_OK:
                # Convert to dict
                return data.to_dict('records')[0] if not data.empty else {}
            else:
                logger.error(f"Account info query failed: {data}")
                return None
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            return None

    def place_order(self, symbol, side, qty, price=0, order_type='NORMAL', 
                   stop_price=None, trail_type=None, trail_value=None, trail_spread=None,
                   fill_outside_rth=False, time_in_force='DAY'):
        """
        Places an order.
        side: 'BUY' or 'SELL'
        order_type: 'NORMAL', 'MARKET', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP_LIMIT'
        """
        if not self.connect():
            return {"status": "error", "msg": "Not connected"}

        # Map Side
        trd_side = TrdSide.BUY if side.upper() == 'BUY' else TrdSide.SELL
        
        # Map Order Type
        ot_map = {
            'NORMAL': OrderType.NORMAL,
            'MARKET': OrderType.MARKET,
            'STOP': OrderType.STOP,
            'STOP_LIMIT': OrderType.STOP_LIMIT,
            'TRAILING_STOP': OrderType.TRAILING_STOP,
            'TRAILING_STOP_LIMIT': OrderType.TRAILING_STOP_LIMIT
        }
        futu_ot = ot_map.get(order_type.upper(), OrderType.NORMAL)

        # Map TimeInForce
        tif = TimeInForce.GTC if time_in_force == 'GTC' else TimeInForce.DAY

        # Trigger Price (aux_price)
        aux_price = 0
        if futu_ot in [OrderType.STOP, OrderType.STOP_LIMIT, OrderType.MARKET_IF_TOUCHED, OrderType.LIMIT_IF_TOUCHED]:
            if stop_price is None:
                 return {"status": "error", "msg": "Stop Price required for Stop orders"}
            aux_price = float(stop_price)
        
        # Trailing params
        futu_trail_type = TrailType.RATIO # Default
        futu_trail_value = 0
        futu_trail_spread = 0
        
        if futu_ot in [OrderType.TRAILING_STOP, OrderType.TRAILING_STOP_LIMIT]:
            if trail_value is None:
                return {"status": "error", "msg": "Trail Value required"}
            futu_trail_value = float(trail_value)
            
            if trail_type == 'AMOUNT':
                futu_trail_type = TrailType.AMOUNT
                
            if futu_ot == OrderType.TRAILING_STOP_LIMIT:
                if trail_spread is None:
                    return {"status": "error", "msg": "Trail Spread required for Trailing Stop Limit"}
                futu_trail_spread = float(trail_spread)

        try:
            ret, data = self.ctx.place_order(
                price=float(price) if price else 0,
                qty=float(qty),
                code=symbol,
                trd_side=trd_side,
                order_type=futu_ot,
                aux_price=aux_price,
                trail_type=futu_trail_type,
                trail_value=futu_trail_value,
                trail_spread=futu_trail_spread,
                trd_env=TrdEnv.REAL,
                fill_outside_rth=fill_outside_rth,
                time_in_force=tif
            )

            if ret == RET_OK:
                return {"status": "success", "order_id": data['order_id'][0] if isinstance(data, pd.DataFrame) else data['order_id']}
            else:
                return {"status": "error", "msg": str(data)}

        except Exception as e:
            return {"status": "error", "msg": str(e)}

moomoo_service = MoomooService()
