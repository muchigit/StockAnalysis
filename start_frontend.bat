@echo off
cd /d %~dp0
echo Starting Frontend Application...
echo Dashboard will be available at http://localhost:3000
cd investment_app\frontend
npm run dev
pause
