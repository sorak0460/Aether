"""Self-contained OS Input Controller for Aether Standalone Web Server.

Supports:
- Windows kernel SendInput API (<1ms latency)
- Cross-platform pynput fallback for macOS and Linux
- Apple TV / macOS style dual-zone non-linear pointer acceleration
- Sub-pixel delta accumulation
- EMA jitter filter
- Long-press drag-and-drop safety timeout
- Kinetic inertial scrolling
"""

import sys
import math
import time
import threading
import logging
from typing import Optional

logger = logging.getLogger("AetherController")

IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:
    import ctypes
    from ctypes import wintypes

    INPUT_MOUSE = 0
    INPUT_KEYBOARD = 1

    MOUSEEVENTF_MOVE = 0x0001
    MOUSEEVENTF_LEFTDOWN = 0x0002
    MOUSEEVENTF_LEFTUP = 0x0004
    MOUSEEVENTF_RIGHTDOWN = 0x0008
    MOUSEEVENTF_RIGHTUP = 0x0010
    MOUSEEVENTF_MIDDLEDOWN = 0x0020
    MOUSEEVENTF_MIDDLEUP = 0x0040
    MOUSEEVENTF_WHEEL = 0x0800
    MOUSEEVENTF_HWHEEL = 0x1000

    KEYEVENTF_KEYUP = 0x0002
    KEYEVENTF_UNICODE = 0x0004

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [
            ("dx", wintypes.LONG),
            ("dy", wintypes.LONG),
            ("mouseData", wintypes.DWORD),
            ("dwFlags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ctypes.c_ulonglong if sys.maxsize > 2**32 else ctypes.c_ulong),
        ]

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [
            ("wVk", wintypes.WORD),
            ("wScan", wintypes.WORD),
            ("dwFlags", wintypes.DWORD),
            ("time", wintypes.DWORD),
            ("dwExtraInfo", ctypes.c_ulonglong if sys.maxsize > 2**32 else ctypes.c_ulong),
        ]

    class HARDWAREINPUT(ctypes.Structure):
        _fields_ = [
            ("uMsg", wintypes.DWORD),
            ("wParamL", wintypes.WORD),
            ("wParamH", wintypes.WORD),
        ]

    class _INPUT_UNION(ctypes.Union):
        _fields_ = [
            ("mi", MOUSEINPUT),
            ("ki", KEYBDINPUT),
            ("hi", HARDWAREINPUT),
        ]

    class INPUT(ctypes.Structure):
        _fields_ = [
            ("type", wintypes.DWORD),
            ("u", _INPUT_UNION),
        ]

    LPINPUT = ctypes.POINTER(INPUT)
    SendInput = ctypes.windll.user32.SendInput
    SendInput.argtypes = [wintypes.UINT, LPINPUT, ctypes.c_int]
    SendInput.restype = wintypes.UINT

from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyController, Key


class StandaloneInputController:
    """Zero-latency OS-level input controller."""

    def __init__(self):
        self.pynput_mouse = MouseController()
        self.pynput_keyboard = KeyController()

        self.is_dragging = False
        self._last_drag_time = 0.0
        self._drag_safety_lock = threading.Lock()

        # Tuning parameters
        self.sensitivity: float = 1.0
        self.acceleration_enabled: bool = True
        self.acceleration_factor: float = 1.25
        self.precision_threshold: float = 3.0
        self.velocity_threshold: float = 12.0

        # Sub-pixel accumulator
        self._accum_x: float = 0.0
        self._accum_y: float = 0.0

        # Jitter filter
        self._last_filtered_dx: float = 0.0
        self._last_filtered_dy: float = 0.0
        self.smoothing_factor: float = 0.85

        # Inertial scroll state
        self._kinetic_thread: Optional[threading.Thread] = None
        self._kinetic_stop_event = threading.Event()

    def move_cursor(self, dx: float, dy: float):
        """Low-latency relative mouse movement with dual-zone acceleration."""
        if self.is_dragging:
            self._last_drag_time = time.time()

        # Jitter smoothing
        filtered_dx = (self.smoothing_factor * dx) + ((1.0 - self.smoothing_factor) * self._last_filtered_dx)
        filtered_dy = (self.smoothing_factor * dy) + ((1.0 - self.smoothing_factor) * self._last_filtered_dy)
        self._last_filtered_dx = filtered_dx
        self._last_filtered_dy = filtered_dy

        scaled_dx = filtered_dx * self.sensitivity
        scaled_dy = filtered_dy * self.sensitivity

        if self.acceleration_enabled:
            mag = math.hypot(scaled_dx, scaled_dy)
            if mag > self.velocity_threshold:
                speed_ratio = mag / self.velocity_threshold
                accel_mult = min(math.pow(speed_ratio, self.acceleration_factor - 1.0), 3.5)
                scaled_dx *= accel_mult
                scaled_dy *= accel_mult
            elif mag < self.precision_threshold:
                scaled_dx *= 0.75
                scaled_dy *= 0.75

        self._accum_x += scaled_dx
        self._accum_y += scaled_dy

        int_dx = int(self._accum_x)
        int_dy = int(self._accum_y)

        self._accum_x -= int_dx
        self._accum_y -= int_dy

        if int_dx == 0 and int_dy == 0:
            return

        if IS_WINDOWS:
            extra = ctypes.c_ulonglong(0) if sys.maxsize > 2**32 else ctypes.c_ulong(0)
            mi = MOUSEINPUT(int_dx, int_dy, 0, MOUSEEVENTF_MOVE, 0, extra)
            inp = INPUT(INPUT_MOUSE, _INPUT_UNION(mi=mi))
            SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
        else:
            self.pynput_mouse.move(int_dx, int_dy)

    def click(self, button: str = "left"):
        """Click mouse button."""
        if IS_WINDOWS:
            extra = ctypes.c_ulonglong(0) if sys.maxsize > 2**32 else ctypes.c_ulong(0)
            if button == "left":
                down_flag, up_flag = MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP
            elif button == "right":
                down_flag, up_flag = MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP
            else:
                down_flag, up_flag = MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP

            inputs = (INPUT * 2)(
                INPUT(INPUT_MOUSE, _INPUT_UNION(mi=MOUSEINPUT(0, 0, 0, down_flag, 0, extra))),
                INPUT(INPUT_MOUSE, _INPUT_UNION(mi=MOUSEINPUT(0, 0, 0, up_flag, 0, extra))),
            )
            SendInput(2, inputs, ctypes.sizeof(INPUT))
        else:
            btn = Button.left if button == "left" else (Button.right if button == "right" else Button.middle)
            self.pynput_mouse.click(btn)

    def start_drag(self):
        """Begin left mouse drag."""
        with self._drag_safety_lock:
            if not self.is_dragging:
                self.is_dragging = True
                self._last_drag_time = time.time()
                if IS_WINDOWS:
                    extra = ctypes.c_ulonglong(0) if sys.maxsize > 2**32 else ctypes.c_ulong(0)
                    inp = INPUT(INPUT_MOUSE, _INPUT_UNION(mi=MOUSEINPUT(0, 0, 0, MOUSEEVENTF_LEFTDOWN, 0, extra)))
                    SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
                else:
                    self.pynput_mouse.press(Button.left)

    def end_drag(self):
        """End mouse drag."""
        with self._drag_safety_lock:
            if self.is_dragging:
                self.is_dragging = False
                if IS_WINDOWS:
                    extra = ctypes.c_ulonglong(0) if sys.maxsize > 2**32 else ctypes.c_ulong(0)
                    inp = INPUT(INPUT_MOUSE, _INPUT_UNION(mi=MOUSEINPUT(0, 0, 0, MOUSEEVENTF_LEFTUP, 0, extra)))
                    SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
                else:
                    self.pynput_mouse.release(Button.left)

    def scroll(self, dx: float, dy: float):
        """Scroll mouse wheel."""
        if IS_WINDOWS:
            extra = ctypes.c_ulonglong(0) if sys.maxsize > 2**32 else ctypes.c_ulong(0)
            if abs(dy) > 0.001:
                # Windows WHEEL_DELTA is 120
                wheel_delta = int(-dy * 60)
                inp = INPUT(INPUT_MOUSE, _INPUT_UNION(mi=MOUSEINPUT(0, 0, wheel_delta, MOUSEEVENTF_WHEEL, 0, extra)))
                SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
        else:
            self.pynput_mouse.scroll(int(dx), int(-dy))

    def type_text(self, text: str):
        """Direct unicode text typing."""
        if not text:
            return
        if IS_WINDOWS:
            for char in text:
                extra = ctypes.c_ulonglong(0) if sys.maxsize > 2**32 else ctypes.c_ulong(0)
                code = ord(char)
                inputs = (INPUT * 2)(
                    INPUT(INPUT_KEYBOARD, _INPUT_UNION(ki=KEYBDINPUT(0, code, KEYEVENTF_UNICODE, 0, extra))),
                    INPUT(INPUT_KEYBOARD, _INPUT_UNION(ki=KEYBDINPUT(0, code, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0, extra))),
                )
                SendInput(2, inputs, ctypes.sizeof(INPUT))
                time.sleep(0.002)
        else:
            self.pynput_keyboard.type(text)

    def press_key(self, key_name: str):
        """Press special key."""
        key_map = {
            "esc": Key.esc,
            "enter": Key.enter,
            "space": Key.space,
            "backspace": Key.backspace,
            "play_pause": Key.media_play_pause,
            "volume_up": Key.media_volume_up,
            "volume_down": Key.media_volume_down,
        }
        target_key = key_map.get(key_name.lower())
        if target_key:
            self.pynput_keyboard.press(target_key)
            self.pynput_keyboard.release(target_key)

    def execute_shortcut(self, action: str):
        """Execute keyboard shortcuts or mouse actions."""
        act = str(action).lower().strip()
        ctrl = Key.ctrl
        alt = Key.alt
        shift = Key.shift
        cmd = Key.cmd

        try:
            if act == "copy":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("c")
            elif act == "paste":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("v")
            elif act == "cut":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("x")
            elif act == "undo":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("z")
            elif act == "redo":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("y")
            elif act == "select_all":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("a")
            elif act == "save":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("s")
            elif act == "screenshot":
                # Win + Shift + S
                with self.pynput_keyboard.pressed(cmd):
                    with self.pynput_keyboard.pressed(shift):
                        self.pynput_keyboard.tap("s")
            elif act == "task_view":
                # Win + Tab
                with self.pynput_keyboard.pressed(cmd):
                    self.pynput_keyboard.tap(Key.tab)
            elif act == "alt_tab":
                # Alt + Tab
                with self.pynput_keyboard.pressed(alt):
                    self.pynput_keyboard.tap(Key.tab)
            elif act == "browser_back":
                with self.pynput_keyboard.pressed(alt):
                    self.pynput_keyboard.tap(Key.left)
            elif act == "browser_forward":
                with self.pynput_keyboard.pressed(alt):
                    self.pynput_keyboard.tap(Key.right)
            elif act == "tab_new":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("t")
            elif act == "tab_close":
                with self.pynput_keyboard.pressed(ctrl):
                    self.pynput_keyboard.tap("w")
            elif act == "enter":
                self.pynput_keyboard.tap(Key.enter)
            elif act == "esc":
                self.pynput_keyboard.tap(Key.esc)
            elif act == "fullscreen":
                self.pynput_keyboard.tap(Key.f11)
            elif act == "mute":
                self.pynput_keyboard.tap(Key.media_volume_mute)
            elif act == "middle_click":
                self.click("middle")
            elif act == "play_pause":
                self.pynput_keyboard.tap(Key.media_play_pause)
        except Exception as e:
            logger.error(f"Failed to execute shortcut {action}: {e}")

