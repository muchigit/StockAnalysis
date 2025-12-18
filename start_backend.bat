@echo off
cd /d %~dp0
echo Starting Backend Server...
echo API Docs will be available at http://localhost:8000/docs
cd investment_app
python -m uvicorn backend.main:app --reload --port 8000
pause
