"""Aether Standalone Web Server & Remote Controller.

Runs HTTP Web Server (port 8080) and WebSocket Controller (port 53821)
concurrently. Allows any phone (iPhone Safari, Android Chrome) or another PC
to control this computer over Wi-Fi without installing an app.
"""

import sys
import os

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import json
import socket
import asyncio
import logging
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
import websockets

from controller import StandaloneInputController

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("AetherWebServer")

HTTP_PORT = 8080
WS_PORT = 53821
WEB_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web_remote")


def get_local_ip() -> str:
    """Detect primary local IPv4 address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def print_ascii_qr(url: str):
    """Print ASCII QR Code to terminal for instant scanning with iPhone."""
    try:
        import qrcode
        qr = qrcode.QRCode(border=1)
        qr.add_data(url)
        qr.make(fit=True)
        print("\n" + "=" * 55)
        print("   📱 SCAN THIS QR CODE WITH YOUR IPHONE / PHONE CAMERA   ")
        print("=" * 55)
        qr.print_ascii(invert=True)
        print("=" * 55 + "\n")
    except ImportError:
        pass


class SafeServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        pass


class SafeHTTPRequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def log_error(self, format, *args):
        pass

    def end_headers(self):
        try:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        except Exception:
            pass
        super().end_headers()


def run_http_server(host: str, port: int):
    """Start background HTTP static server for web_remote."""
    handler_class = partial(SafeHTTPRequestHandler, directory=WEB_ROOT)
    server = SafeServer((host, port), handler_class)
    logger.info("HTTP Server serving %s on http://%s:%d", WEB_ROOT, host, port)
    server.serve_forever()



class WebRemoteServer:
    def __init__(self):
        self.controller = StandaloneInputController()

    def process_message(self, raw_data: str):
        try:
            msg = json.loads(raw_data.strip())
            msg_type = msg.get("type", "")

            if msg_type == "move":
                dx = float(msg.get("dx", 0.0))
                dy = float(msg.get("dy", 0.0))
                self.controller.move_cursor(dx, dy)

            elif msg_type == "click":
                btn = msg.get("btn", "left")
                self.controller.click(btn)

            elif msg_type == "drag_start":
                self.controller.start_drag()

            elif msg_type == "drag_end":
                self.controller.end_drag()

            elif msg_type == "scroll":
                dx = float(msg.get("dx", 0.0))
                dy = float(msg.get("dy", 0.0))
                self.controller.scroll(dx, dy)

            elif msg_type == "text":
                text = msg.get("text", "")
                if text:
                    self.controller.type_text(text)

            elif msg_type == "key":
                key_name = msg.get("key", "")
                if key_name:
                    self.controller.press_key(key_name)

            elif msg_type == "shortcut":
                action = msg.get("action", "")
                if action:
                    self.controller.execute_shortcut(action)

            elif msg_type == "set_config":
                if "sensitivity" in msg:
                    self.controller.sensitivity = float(msg["sensitivity"])
                if "acceleration" in msg:
                    self.controller.acceleration_enabled = bool(msg["acceleration"])
                return {
                    "type": "ack",
                    "sensitivity": self.controller.sensitivity,
                    "acceleration": self.controller.acceleration_enabled
                }

        except Exception as e:
            logger.error("Error handling message: %s", e)
        return None

    async def handle_ws(self, websocket):
        client_ip = websocket.remote_address[0]
        logger.info("Remote device connected: %s", client_ip)
        try:
            async for raw in websocket:
                resp = self.process_message(raw)
                if resp:
                    await websocket.send(json.dumps(resp))
        except Exception:
            pass
        finally:
            logger.info("Remote device disconnected: %s", client_ip)


async def main_async():
    local_ip = get_local_ip()
    remote_url = f"http://{local_ip}:{HTTP_PORT}"

    print("\n" + "=" * 62)
    print("           AETHER STANDALONE WEB REMOTE SERVER            ")
    print("=" * 62)
    print(f" * Web Remote URL    : {remote_url}")
    print(f" * WebSocket Port    : {WS_PORT}")
    print(f" * Operating System  : {sys.platform}")
    print("-" * 62)
    print(f" Open on iPhone (Safari) or Android (Chrome):")
    print(f"   👉 {remote_url}")
    print("-" * 62)

    print_ascii_qr(remote_url)

    # Launch HTTP server in background thread
    http_thread = threading.Thread(target=run_http_server, args=("0.0.0.0", HTTP_PORT), daemon=True)
    http_thread.start()

    # Launch WebSocket server
    server = WebRemoteServer()
    async with websockets.serve(server.handle_ws, "0.0.0.0", WS_PORT, ping_interval=20, ping_timeout=20):
        logger.info("WebSocket listener ready on port %d", WS_PORT)
        while True:
            await asyncio.sleep(1)


def main():
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\nShutting down Aether Web Server cleanly...")


if __name__ == "__main__":
    main()
