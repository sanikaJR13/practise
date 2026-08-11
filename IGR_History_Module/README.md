# Standalone IGR History Module (Django + PostgreSQL)

This is a self-contained module for scraping and viewing Maharashtra IGR (Land Registration) history. It contains its own React frontend, Django backend, PostgreSQL database, and automatic OCR CAPTCHA solver.

## Directory Structure

```
IGR_History_Module/
├── backend/                  # Django Application
│   ├── manage.py             # Administrative utility
│   ├── backend/              # Project settings and root URLs
│   ├── igr_api/              # API app, models, views, and serializers
│   ├── scrapers/             # Ported Maharashtra IGR scrapers
│   └── requirements.txt      # Python dependencies
└── frontend/                 # Vite + React App
    ├── package.json          # Node dependencies
    ├── vite.config.js        # Vite config with path resolution
    └── src/                  # React source files
```

## Setup & Running Instructions

### Prerequisite 1: Tesseract OCR (For automatic CAPTCHA solving)
To use the automatic OCR features, ensure Tesseract OCR is installed on your machine.
- Default path checked: `C:\Program Files\Tesseract-OCR\tesseract.exe`
- If installed elsewhere, set the `TESSERACT_CMD` environment variable or specify it when running the app.

### Prerequisite 2: PostgreSQL Database
1. Open **pgAdmin 4** or connect via psql command line.
2. Create a new empty database named `igr_history`.
3. Open `IGR_History_Module/backend/backend/settings.py` and modify the `DATABASES` settings to match your local PostgreSQL password and username if they differ from the defaults:
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'NAME': 'igr_history',
           'USER': 'postgres',
           'PASSWORD': 'YOUR_PASSWORD_HERE',
           'HOST': 'localhost',
           'PORT': '5432',
       }
   }
   ```

---

### 1. Run the Django Backend

1. Open PowerShell or command line and navigate to the backend directory:
   ```bash
   cd "D:\my\PropJunction original\PropJunction1.1\IGR_History_Module\backend"
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - **Windows PowerShell**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows Command Prompt**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Apply database migrations to create PostgreSQL tables:
   ```bash
   python manage.py migrate
   ```

6. Start the Django development server:
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```
   The backend API will start at `http://127.0.0.1:8000`.

---

### 2. Run the Frontend

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd "D:\my\PropJunction original\PropJunction1.1\IGR_History_Module\frontend"
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend application will start at `http://localhost:5173`. Open it in your web browser to perform searches and inspect property transaction histories!
