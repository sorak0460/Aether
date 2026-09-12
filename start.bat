@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================================
echo          Aether Standalone Web Remote Server
echo ========================================================
echo [*] Checking Python environment...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python is not installed or not in PATH!
    echo [!] Please install Python 3.9+ from https://www.python.org/
    pause
    exit /b 1
)

echo [*] Checking dependencies...
python -c "import websockets, pynput, qrcode" >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Installing required packages (websockets, pynput, qrcode)...
    pip install -r requirements.txt
)

echo [*] Starting Aether Web Remote Server...
python server.py
pause
