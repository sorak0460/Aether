#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "========================================================"
echo "         Aether Standalone Web Remote Server            "
echo "========================================================"

if ! command -v python3 &> /dev/null; then
    echo "[!] python3 could not be found. Please install Python 3.9+."
    exit 1
fi

python3 -c "import websockets, pynput, qrcode" &> /dev/null || {
    echo "[*] Installing required packages..."
    pip3 install -r requirements.txt
}

echo "[*] Starting Aether Web Remote Server..."
python3 server.py
