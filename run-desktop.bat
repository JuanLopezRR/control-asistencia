@echo off
title Control AS - Desktop
cd /d "%~dp0"

echo Iniciando backend...
start "Backend" cmd /c "cd /d "%~dp0backend" && python run.py"

timeout /t 3 /nobreak > nul

echo Iniciando app de escritorio...
start "" "%~dp0frontend\src-tauri\target\release\app.exe"

echo.
echo Para cerrar, cierra la app y la ventana del backend.
pause
