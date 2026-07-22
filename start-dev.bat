@echo off
title Control AS - Dev
echo.
echo === Iniciando Control de Entrada y Salida ===
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo Docs API: http://localhost:8000/docs
echo.
echo Cerra las ventanas para detener los servidores.
echo.

start "Backend" cmd /c ""%~dp0run-backend.bat""
start "Frontend" cmd /c ""%~dp0run-frontend.bat""

pause
