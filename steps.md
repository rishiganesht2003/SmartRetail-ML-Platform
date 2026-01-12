# SmartRetail Project Setup Guide

This guide provides a complete, step-by-step process to run the SmartRetail project on a new system. The project uses Next.js for the frontend, Django + Django REST Framework for the backend, and MySQL for the database.

## Prerequisites and Software Installations

### 1. Install Node.js
- Download and install Node.js (version 18 or later) from [nodejs.org](https://nodejs.org/).
- During installation, ensure npm is included.
- Verify installation: Open Command Prompt and run `node -v` and `npm -v`.

### 2. Install Python 3
- Download and install Python 3 (version 3.8 or later) from [python.org](https://www.python.org/downloads/).
- During installation, check "Add Python to PATH".
- Verify installation: Run `python --version` in Command Prompt.

### 3. Install MySQL Server
- Download and install MySQL Server from [mysql.com](https://dev.mysql.com/downloads/mysql/).
- Choose the community edition.
- During setup, set a root password (remember it for later).
- Install MySQL Workbench (optional, for database management).
- Verify installation: Run `mysql --version` in Command Prompt.

### 4. Install virtualenv (Python virtual environment tool)
- Open Command Prompt and run: `pip install virtualenv`
- Verify: `virtualenv --version`

## Project Setup

### 5. Obtain the Project Files
- Copy or clone the SmartRetailProject directory to your desired location (e.g., `C:\Users\rishi\Desktop\SmartRetailProject`).
- Ensure the directory structure matches the provided environment details.

### 6. Set Up MySQL Database
- Open MySQL Command Line Client (or MySQL Workbench).
- Log in as root with your root password.
- Run the following commands:
  ```
  CREATE DATABASE smartretaildatabase;
  CREATE USER 'smartuser'@'localhost' IDENTIFIED BY 'smartretaildatabase';
  GRANT ALL PRIVILEGES ON smartretaildatabase.* TO 'smartuser'@'localhost';
  FLUSH PRIVILEGES;
  EXIT;
  ```
- This creates the database and user as configured in the backend settings.

## Backend Setup (Django)

### 7. Navigate to Backend Directory
- Open Command Prompt and navigate to the backend directory: `cd C:\Users\rishi\Desktop\SmartRetailProject\backend`

### 8. Create and Activate Virtual Environment
- Run: `virtualenv venv`
- Activate: `venv\Scripts\activate` (you should see `(venv)` in the prompt)

### 9. Install Python Dependencies
- Run: `pip install -r requirements.txt`
- This installs Django, DRF, MySQL client, and other required packages.

### 10. Run Database Migrations
- Run: `python manage.py migrate`
- This sets up the database tables based on the models.

### 11. Create Superuser (Admin Account)
- Run: `python manage.py createsuperuser`
- Follow prompts to create an admin username, email, and password.

### 12. Start Backend Server
- Run: `python manage.py runserver`
- The backend will run on `http://127.0.0.1:8000`
- Keep this terminal open.

## Frontend Setup (Next.js)

### 13. Open New Command Prompt Window
- Navigate to the frontend directory: `cd C:\Users\rishi\Desktop\SmartRetailProject\frontend`

### 14. Install Node.js Dependencies
- Run: `npm install`
- This installs Next.js, React, and other frontend dependencies.

### 15. Set Environment Variables (if needed)
- If the backend is not running on `http://127.0.0.1:8000`, create a `.env.local` file in the frontend directory with:
  ```
  NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
  ```
- The frontend defaults to this URL if not set.

### 16. Start Frontend Development Server
- Run: `npm run dev`
- The frontend will run on `http://localhost:3000`
- Open a web browser and navigate to `http://localhost:3000` to access the application.

## Accessing the Application

- **Frontend (Customer/Admin Interface):** `http://localhost:3000`
- **Backend API:** `http://127.0.0.1:8000`
- **Admin Panel:** `http://127.0.0.1:8000/admin` (use superuser credentials)

## Common Errors and Fixes

### MySQL Connection Issues
- **Error:** "Can't connect to MySQL server"
- **Fix:** Ensure MySQL service is running. Start it via Windows Services or MySQL Workbench. Verify host (127.0.0.1) and port (3306).

### Database Authentication Errors
- **Error:** "Access denied for user 'smartuser'"
- **Fix:** Double-check the database credentials in `backend/config/settings.py`. Ensure the MySQL user was created correctly.

### Missing Python Packages
- **Error:** ImportError for packages like mysqlclient
- **Fix:** Ensure you're in the activated virtual environment. Re-run `pip install -r requirements.txt`. On Windows, you may need to install MySQL development headers if issues persist.

### Port Conflicts
- **Error:** "Port 8000/3000 already in use"
- **Fix:** Close other applications using these ports. For backend, use `python manage.py runserver 8001` to change port.

### CORS Issues
- **Error:** Frontend can't connect to backend API
- **Fix:** Ensure backend is running and CORS is configured (it's set to allow all origins in settings.py).

### Node.js/npm Issues
- **Error:** npm install fails
- **Fix:** Clear npm cache with `npm cache clean --force` and retry. Ensure Node.js version is compatible.

### Django Migrations Fail
- **Error:** Migration issues
- **Fix:** Ensure database exists and user has permissions. Drop and recreate database if needed.

## Additional Notes
- The backend uses JWT authentication for API calls.
- Static files and media are served from the backend.
- For production, additional configurations (like SECRET_KEY, DEBUG=False) would be needed, but this guide is for development.
- If using Redis/Celery (mentioned in requirements), install and configure them separately for background tasks.
