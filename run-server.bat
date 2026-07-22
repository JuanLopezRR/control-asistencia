@echo off
title Control AS - MODO SERVIDOR
cd /d "%~dp0"

:: ============================================
:: MODO SERVIDOR (conectado a Supabase)
:: ============================================
set APP_ENV=production
set DATABASE_URL=postgresql://postgres:7AiZXWSIk5SRUA76@db.rbxjwlcuhsfovipupejc.supabase.co:5432/postgres
set API_HOST=0.0.0.0
set API_PORT=8000

echo === MODO SERVIDOR (Supabase) ===
echo.
echo Asegurate de haber ejecutado primero:
echo   cd backend ^&^& alembic upgrade head
echo.
echo Iniciando backend...
start "Backend" cmd /c "cd /d "%~dp0backend" && python run.py"
echo.
echo Backend: http://localhost:8000
echo.
pause
