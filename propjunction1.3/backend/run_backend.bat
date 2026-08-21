@echo off
echo ========================================================
echo   Combined Scraper Backend (712 + 8A + IGR)
echo   Starting on port 8000...
echo ========================================================

cd /d "%~dp0"

IF NOT EXIST "venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate

echo Installing dependencies...
pip install -r requirements.txt

echo Running database migrations...
python manage.py migrate

echo.
echo Starting Django Backend on http://localhost:8000/
echo   API Endpoints:
echo     712:  http://localhost:8000/api/712/
echo     8A:   http://localhost:8000/api/8a/
echo     IGR:  http://localhost:8000/api/igr/
echo ========================================================
python manage.py runserver 0.0.0.0:8000
pause
