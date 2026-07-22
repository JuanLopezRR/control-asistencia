@echo off
title Backend - Control AS
cd /d "%~dp0backend"
echo Iniciando backend (FastAPI)...
echo http://localhost:8000
echo.
python run.py
pause
