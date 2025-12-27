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
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/open_analysis_folder")
def open_analysis_folder():
    # Hardcoded path from user request / gdrive_loader
    # Ideal: import from gdrive_loader but for safety/speed hardcode match
    path = r"G:\マイドライブ\分析レポート 買い リネーム済み"
    
    if not os.path.exists(path):
        # Try fallback or partial match?
        return {"status": "error", "message": f"Folder not found: {path}"}
    
    try:
        os.startfile(path)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class PickFileRequest(BaseModel):
    initial_path: str = ""

@router.post("/pick_file")
def pick_file(request: PickFileRequest):
    import subprocess
    import sys
    
    # Python script to run in subprocess
    # We use base64 or direct script string. Direct string is fine if simple.
    # Logic:
    # 1. Import tkinter
    # 2. Setup root hidden
    # 3. Determine initialdir/initialfile
    # 4. Show dialog
    # 5. Print result
    
    script = f"""
import tkinter as tk
from tkinter import filedialog
import os
import sys

# Hide root window
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)

initial_path = r"{request.initial_path}"
initialdir = ""
initialfile = ""

if initial_path and os.path.exists(initial_path):
    if os.path.isdir(initial_path):
        initialdir = initial_path
    else:
        initialdir = os.path.dirname(initial_path)
        initialfile = os.path.basename(initial_path)

try:
    file_path = filedialog.askopenfilename(
        title='Select File to Import',
        initialdir=initialdir,
        initialfile=initialfile,
        filetypes=[("Data Files", "*.csv *.xlsx *.xls"), ("All Files", "*.*")]
    )
    # Print to stdout for capture
    if file_path:
        print(file_path)
except Exception as e:
    pass
"""
    try:
        # Run the script
        result = subprocess.run(
            [sys.executable, "-c", script], 
            capture_output=True, 
            text=True,
            timeout=120 # Timeout to prevent indefinite hanging if dialog is ignored
        )
        
        selected_path = result.stdout.strip()
        if selected_path:
            return {"status": "success", "path": selected_path}
        else:
            return {"status": "cancelled", "path": ""}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}
