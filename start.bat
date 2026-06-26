@echo off
echo Starting PDF Editor with Font Extraction...
echo.

REM Start Python font server in background
echo [1/2] Starting Python font server on port 5001...
start "PDF Font Server" cmd /k "cd server && pip install pymupdf flask flask-cors && python server.py"

REM Wait 2 seconds for Python to start
timeout /t 2 /nobreak > nul

REM Start React app
echo [2/2] Starting React app on port 5173...
start "PDF Editor React" cmd /k "npm run dev"

echo.
echo Both servers starting...
echo   Python font server: http://localhost:5001
echo   React app:          http://localhost:5173
echo.
echo Open http://localhost:5173 in your browser.
pause
