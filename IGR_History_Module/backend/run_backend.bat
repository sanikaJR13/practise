@echo off
echo ========================================================
echo Starting IGR History Django Backend on Port 8001...
echo ========================================================

cd /d "%~dp0"

IF EXIST "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) ELSE (
    echo [INFO] Virtual environment not found. Using system python...
)

python manage.py runserver 127.0.0.1:8001
pause
