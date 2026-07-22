@echo off
title Control AS - MODO LOCAL
cd /d "%~dp0"
set APP_ENV=development

echo === MODO LOCAL (SQLite - sin internet) ===
echo.
echo Iniciando backend...
start "Backend" cmd /c "cd /d "%~dp0backend" && python run.py"

:: Esperar a que el backend esté listo
echo Esperando al backend...
:wait
timeout /t 2 /nobreak > nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8000/api/health' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" > nul 2>&1
if errorlevel 1 goto wait

echo Backend listo!
echo Iniciando app de escritorio...
start "" "%~dp0frontend\src-tauri\target\release\app.exe"

echo.
echo Backend: http://localhost:8000
echo.
echo Para detener, cierra la ventana del backend.
pause
