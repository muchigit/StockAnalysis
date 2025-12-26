from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import create_db_and_tables
from .routers import stocks, automation

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan, title="Investment Management System")

# CORS for Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(automation.router)
from backend.routers.system import router as system_router
from backend.routers.trading import router as trading_router

app.include_router(system_router)
app.include_router(trading_router)
from backend.routers.alerts import router as alerts_router
app.include_router(alerts_router)

from .routers.history import router as history_router
app.include_router(history_router)
from .routers import filters, system
app.include_router(filters.router)
app.include_router(system.router)
from .routers import prompts
app.include_router(prompts.router)
from .routers import automation_router
app.include_router(automation_router.router)
from .routers import views
app.include_router(views.router)
from .routers import analytics
app.include_router(analytics.router)
from .routers import groups
app.include_router(groups.router)
from .routers import calendar
app.include_router(calendar.router)
# from .routers import automation_router_v2
# app.include_router(automation_router_v2.router)

# Scheduler
import threading
import time
from datetime import datetime, timedelta
import pytz
from .services.update_manager import update_manager

JST = pytz.timezone('Asia/Tokyo')

def scheduler_loop():
    while True:
        try:
            now = datetime.now(JST)
            # Check if it's past 9:30 AM
            target_time = now.replace(hour=9, minute=30, second=0, microsecond=0)
            
            if now >= target_time:
                # Check if we ran today
                last_completed = update_manager.last_completed
                should_run = True
                
                if last_completed:
                    last_dt = datetime.fromisoformat(last_completed)
                    # Use naive comparison if isoformat doesn't have offset, or aware if it does.
                    # update_manager sets it with now(JST).
                    # If last completed date is today, skip.
                    if last_dt.date() == now.date():
                        should_run = False
                
                if should_run:
                    # Also check if it's valid update window? 
                    # Requirement: "If backend starts and it's past 9:30, run if not done".
                    # Requirement: "If running and becomes 9:30, run".
                    print(f"[Scheduler] Starting daily update at {now}")
                    update_manager.start_update()
                    
        except Exception as e:
            print(f"[Scheduler] Error: {e}")
            
        time.sleep(60) # Check every minute

@app.on_event("startup")
def start_scheduler():
    t = threading.Thread(target=scheduler_loop, daemon=True)
    t.start()

@app.get("/")
def read_root():
    return {"message": "Welcome to Investment Management System API"}




# Trigger Reload
