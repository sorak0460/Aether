// Aether Web Remote Controller Client - Phase 4 (Magic Mouse & Shortcuts)

const CONFIG_STORAGE_KEY = "aether_web_config";

// Preset Shortcut Definitions
const SHORTCUT_DEFS = {
  copy: { label: "コピー", icon: "📋" },
  paste: { label: "貼り付け", icon: "📥" },
  cut: { label: "切り取り", icon: "✂️" },
  undo: { label: "元に戻す", icon: "↩️" },
  redo: { label: "やり直す", icon: "↪️" },
  select_all: { label: "全選択", icon: "🔘" },
  save: { label: "保存", icon: "💾" },
  screenshot: { label: "スクショ", icon: "📸" },
  task_view: { label: "タスクビュー", icon: "🪟" },
  alt_tab: { label: "タスク切替", icon: "🔀" },
  browser_back: { label: "戻る", icon: "◀" },
  browser_forward: { label: "進む", icon: "▶" },
  tab_new: { label: "新規タブ", icon: "➕" },
  tab_close: { label: "閉じる", icon: "❌" },
  fullscreen: { label: "全画面", icon: "🖥️" },
  middle_click: { label: "中央クリック", icon: "🖱️" },
  mute: { label: "消音", icon: "🔇" },
  play_pause: { label: "再生/停止", icon: "⏯️" },
  enter: { label: "Enter", icon: "⏎" },
  esc: { label: "Esc", icon: "⎋" },
};

// Default settings
let config = {
  host: window.location.hostname || "127.0.0.1",
  wsPort: 53821,
  sensitivity: 1.2,
  scrollSensitivity: 1.0,
  accelerationEnabled: true,
  hapticEnabled: true,
  activeMode: "remote", // "remote" | "magicmouse"
  slot1: "copy",
  slot2: "paste",
  slot3: "screenshot",
  slot4: "alt_tab",
};

// Load saved settings from localStorage
function loadSavedConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      config = { ...config, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load saved config:", e);
  }

  // Smart host auto-detection:
  // If this web page was opened via a specific IP or hostname (e.g. 192.168.x.x on mobile),
  // NEVER allow a stale 'localhost' or '127.0.0.1' from localStorage to misdirect the connection.
  const currentHost = window.location.hostname;
  if (currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
    if (!config.host || config.host === "localhost" || config.host === "127.0.0.1") {
      config.host = currentHost;
    }
  } else if (!config.host) {
    config.host = currentHost || "127.0.0.1";
  }
}

// Save settings to localStorage
function saveConfig() {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn("Failed to save config:", e);
  }
}

loadSavedConfig();

// DOM Elements
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const trackpad = document.getElementById("trackpad");
const trackpadHint = document.getElementById("trackpadHint");

// Mode Switch Elements
const btnModeRemote = document.getElementById("btnModeRemote");
const btnModeMagicMouse = document.getElementById("btnModeMagicMouse");
const remoteView = document.getElementById("remoteView");
const magicMouseView = document.getElementById("magicMouseView");

// Settings Modal DOM Elements
const settingsModal = document.getElementById("settingsModal");
const btnSettings = document.getElementById("btnSettings");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const settingHost = document.getElementById("settingHost");
const settingSensitivity = document.getElementById("settingSensitivity");
const settingScroll = document.getElementById("settingScroll");
const settingAcceleration = document.getElementById("settingAcceleration");
const settingHaptic = document.getElementById("settingHaptic");
const valSensitivity = document.getElementById("valSensitivity");
const valScroll = document.getElementById("valScroll");
const settingSlot1 = document.getElementById("settingSlot1");
const settingSlot2 = document.getElementById("settingSlot2");
const settingSlot3 = document.getElementById("settingSlot3");
const settingSlot4 = document.getElementById("settingSlot4");

// Magic Mouse Shortcut Dock Elements
const mmSlot1 = document.getElementById("mmSlot1");
const mmSlot2 = document.getElementById("mmSlot2");
const mmSlot3 = document.getElementById("mmSlot3");
const mmSlot4 = document.getElementById("mmSlot4");
const mmSlot1Icon = document.getElementById("mmSlot1Icon");
const mmSlot1Label = document.getElementById("mmSlot1Label");
const mmSlot2Icon = document.getElementById("mmSlot2Icon");
const mmSlot2Label = document.getElementById("mmSlot2Label");
const mmSlot3Icon = document.getElementById("mmSlot3Icon");
const mmSlot3Label = document.getElementById("mmSlot3Label");
const mmSlot4Icon = document.getElementById("mmSlot4Icon");
const mmSlot4Label = document.getElementById("mmSlot4Label");

function updateShortcutDockUI() {
  const s1 = SHORTCUT_DEFS[config.slot1] || SHORTCUT_DEFS.copy;
  const s2 = SHORTCUT_DEFS[config.slot2] || SHORTCUT_DEFS.paste;
  const s3 = SHORTCUT_DEFS[config.slot3] || SHORTCUT_DEFS.screenshot;
  const s4 = SHORTCUT_DEFS[config.slot4] || SHORTCUT_DEFS.alt_tab;

  if (mmSlot1Icon) mmSlot1Icon.textContent = s1.icon;
  if (mmSlot1Label) mmSlot1Label.textContent = s1.label;
  if (mmSlot2Icon) mmSlot2Icon.textContent = s2.icon;
  if (mmSlot2Label) mmSlot2Label.textContent = s2.label;
  if (mmSlot3Icon) mmSlot3Icon.textContent = s3.icon;
  if (mmSlot3Label) mmSlot3Label.textContent = s3.label;
  if (mmSlot4Icon) mmSlot4Icon.textContent = s4.icon;
  if (mmSlot4Label) mmSlot4Label.textContent = s4.label;

  if (settingSlot1) settingSlot1.value = config.slot1;
  if (settingSlot2) settingSlot2.value = config.slot2;
  if (settingSlot3) settingSlot3.value = config.slot3;
  if (settingSlot4) settingSlot4.value = config.slot4;
}

function updateSettingsUI() {
  const currentLoc = window.location.hostname;
  if (currentLoc && currentLoc !== "localhost" && currentLoc !== "127.0.0.1") {
    if (config.host === "localhost" || config.host === "127.0.0.1") {
      config.host = currentLoc;
    }
  }
  settingHost.value = config.host || currentLoc || "127.0.0.1";
  settingSensitivity.value = config.sensitivity;
  settingScroll.value = config.scrollSensitivity;
  settingAcceleration.checked = config.accelerationEnabled;
  settingHaptic.checked = config.hapticEnabled;
  valSensitivity.textContent = `${Number(config.sensitivity).toFixed(1)}x`;
  valScroll.textContent = `${Number(config.scrollSensitivity).toFixed(1)}x`;

  updateShortcutDockUI();
}

function setMode(mode) {
  config.activeMode = mode;
  if (mode === "magicmouse") {
    btnModeMagicMouse.classList.add("active");
    btnModeRemote.classList.remove("active");
    magicMouseView.classList.add("active");
    remoteView.classList.remove("active");
  } else {
    btnModeRemote.classList.add("active");
    btnModeMagicMouse.classList.remove("active");
    remoteView.classList.add("active");
    magicMouseView.classList.remove("active");
  }
  saveConfig();
}

btnModeRemote.addEventListener("click", () => {
  vibrate(20);
  setMode("remote");
});

btnModeMagicMouse.addEventListener("click", () => {
  vibrate(20);
  setMode("magicmouse");
});

// Initialize UI
updateSettingsUI();
setMode(config.activeMode || "remote");

// Haptic feedback helper
function vibrate(ms) {
  if (config.hapticEnabled && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

// WebSocket Connection with Auto-reconnect
let socket = null;
let isConnected = false;

function connectWebSocket() {
  const currentLoc = window.location.hostname;
  let currentHost = config.host || currentLoc || "127.0.0.1";
  if (currentLoc && currentLoc !== "localhost" && currentLoc !== "127.0.0.1") {
    if (currentHost === "localhost" || currentHost === "127.0.0.1") {
      currentHost = currentLoc;
      config.host = currentLoc;
    }
  }

  const wsUrl = `ws://${currentHost}:${config.wsPort}`;
  statusText.textContent = `Connecting to ${currentHost}...`;
  statusDot.className = "status-dot reconnecting";

  try {
    if (socket) {
      socket.close();
    }
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      isConnected = true;
      statusText.textContent = `Connected (${currentHost})`;
      statusDot.className = "status-dot connected";

      // Sync settings with host
      sendCommand({
        type: "set_config",
        sensitivity: config.sensitivity,
        acceleration: config.accelerationEnabled,
      });
    };

    socket.onclose = () => {
      isConnected = false;
      statusText.textContent = `Reconnecting (${currentHost})...`;
      statusDot.className = "status-dot reconnecting";
      setTimeout(connectWebSocket, 2000);
    };

    socket.onerror = () => {
      statusText.textContent = `Error (${currentHost})`;
      socket.close();
    };
  } catch (e) {
    statusText.textContent = `Error (${currentHost})`;
    setTimeout(connectWebSocket, 2000);
  }
}

function sendCommand(cmd) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(cmd));
  }
}

// Frame-Synchronized Motion Coalescer (Prevents Wi-Fi Jitter & Bufferbloat)
let pendingDx = 0;
let pendingDy = 0;
let isMoveScheduled = false;

function queueMouseMove(dx, dy) {
  pendingDx += dx;
  pendingDy += dy;

  if (!isMoveScheduled) {
    isMoveScheduled = true;
    requestAnimationFrame(() => {
      isMoveScheduled = false;
      if (Math.abs(pendingDx) > 0.001 || Math.abs(pendingDy) > 0.001) {
        if (socket && socket.readyState === WebSocket.OPEN) {
          // If network is congested (bufferedAmount backed up), hold accumulation for next frame
          if (socket.bufferedAmount < 4096) {
            socket.send(JSON.stringify({ type: "move", dx: pendingDx, dy: pendingDy }));
            pendingDx = 0;
            pendingDy = 0;
          }
        }
      }
    });
  }
}

let pendingScrollDx = 0;
let pendingScrollDy = 0;
let isScrollScheduled = false;

function queueScroll(dx, dy) {
  pendingScrollDx += dx;
  pendingScrollDy += dy;

  if (!isScrollScheduled) {
    isScrollScheduled = true;
    requestAnimationFrame(() => {
      isScrollScheduled = false;
      if (Math.abs(pendingScrollDx) > 0.001 || Math.abs(pendingScrollDy) > 0.001) {
        if (socket && socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 4096) {
          socket.send(JSON.stringify({ type: "scroll", dx: pendingScrollDx, dy: pendingScrollDy }));
          pendingScrollDx = 0;
          pendingScrollDy = 0;
        }
      }
    });
  }
}

// Trackpad Touch & Pointer Logic
let activePointers = new Map();
let isDraggingMode = false;
let longPressTimer = null;
let touchStartTime = 0;
let totalMovedDistance = 0;
let lastScrollTime = 0;
let lastScrollDy = 0;

const DEADZONE_PX = 1.5;

trackpad.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  trackpad.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, time: Date.now() });
  trackpad.classList.add("active");

  if (activePointers.size === 1) {
    touchStartTime = Date.now();
    totalMovedDistance = 0;

    // Start long-press timer for drag (420ms)
    longPressTimer = setTimeout(() => {
      if (totalMovedDistance < 12 && activePointers.size === 1) {
        isDraggingMode = true;
        trackpad.classList.add("dragging");
        trackpadHint.textContent = "DRAGGING";
        vibrate(60);
        sendCommand({ type: "drag_start" });
      }
    }, 420);
  } else if (activePointers.size === 2) {
    clearTimeout(longPressTimer);
    if (isDraggingMode) {
      isDraggingMode = false;
      trackpad.classList.remove("dragging");
      trackpadHint.textContent = "TRACKPAD";
      sendCommand({ type: "drag_end" });
    }
  }
});

trackpad.addEventListener("pointermove", (e) => {
  e.preventDefault();
  if (!activePointers.has(e.pointerId)) return;

  const prev = activePointers.get(e.pointerId);
  const now = Date.now();
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, time: now });

  const moveMag = Math.hypot(dx, dy);
  totalMovedDistance += moveMag;

  if (activePointers.size === 1) {
    // 1-Finger move (Cursor motion) scaled by user sensitivity
    if (moveMag > DEADZONE_PX || isDraggingMode) {
      const sens = config.sensitivity || 1.0;
      queueMouseMove(dx * sens, dy * sens);
    }
  } else if (activePointers.size === 2) {
    // 2-Finger scroll scaled by user scroll sensitivity
    clearTimeout(longPressTimer);
    lastScrollTime = now;
    lastScrollDy = dy;
    const scrollSens = config.scrollSensitivity || 1.0;
    queueScroll(dx * 0.1 * scrollSens, dy * 0.25 * scrollSens);
  }
});

function endPointer(e) {
  e.preventDefault();
  clearTimeout(longPressTimer);
  const wasSingle = activePointers.size === 1;
  const wasDouble = activePointers.size === 2;
  activePointers.delete(e.pointerId);

  if (activePointers.size === 0) {
    trackpad.classList.remove("active");

    if (isDraggingMode) {
      isDraggingMode = false;
      trackpad.classList.remove("dragging");
      trackpadHint.textContent = "TRACKPAD";
      vibrate(30);
      sendCommand({ type: "drag_end" });
    } else if (wasSingle && Date.now() - touchStartTime < 350 && totalMovedDistance < 10) {
      // Tap -> Left click
      vibrate(25);
      sendCommand({ type: "click", btn: "left", act: "click" });
    }
  } else if (wasDouble && activePointers.size === 1) {
    // Check for kinetic scroll flick release
    const dt = Math.max(1, Date.now() - lastScrollTime);
    if (dt < 80) {
      const scrollSens = config.scrollSensitivity || 1.0;
      const vy = (lastScrollDy / dt) * 1000 * scrollSens;
      if (Math.abs(vy) > 150) {
        sendCommand({ type: "scroll", dx: 0, dy: 0, vy: vy });
      }
    }
  }
}

trackpad.addEventListener("pointerup", endPointer);
trackpad.addEventListener("pointercancel", endPointer);

// Remote Buttons
document.getElementById("btnLeftClick").addEventListener("click", () => {
  vibrate(30);
  sendCommand({ type: "click", btn: "left", act: "click" });
});

document.getElementById("btnRightClick").addEventListener("click", () => {
  vibrate(30);
  sendCommand({ type: "click", btn: "right", act: "click" });
});

document.getElementById("btnType").addEventListener("click", () => {
  textModal.classList.add("open");
  textToSend.focus();
});

document.getElementById("btnBack").addEventListener("click", () => {
  sendCommand({ type: "key", key: "esc" });
});

document.getElementById("btnPlay").addEventListener("click", () => {
  sendCommand({ type: "key", key: "play_pause" });
});

document.getElementById("btnVolUp").addEventListener("click", () => {
  sendCommand({ type: "key", key: "volume_up" });
});

document.getElementById("btnVolDown").addEventListener("click", () => {
  sendCommand({ type: "key", key: "volume_down" });
});

// Settings Modal Event Listeners
btnSettings.addEventListener("click", () => {
  updateSettingsUI();
  settingsModal.classList.add("open");
});

function closeSettings() {
  settingsModal.classList.remove("open");
}

btnCloseSettings.addEventListener("click", closeSettings);
btnSaveSettings.addEventListener("click", () => {
  const newHost = settingHost.value.trim() || window.location.hostname || "127.0.0.1";
  const hostChanged = newHost !== config.host;

  config.host = newHost;
  if (settingSlot1) config.slot1 = settingSlot1.value;
  if (settingSlot2) config.slot2 = settingSlot2.value;
  if (settingSlot3) config.slot3 = settingSlot3.value;
  if (settingSlot4) config.slot4 = settingSlot4.value;

  saveConfig();
  updateShortcutDockUI();
  closeSettings();

  if (hostChanged) {
    connectWebSocket();
  }
});

[settingSlot1, settingSlot2, settingSlot3, settingSlot4].forEach((sel, idx) => {
  if (sel) {
    sel.addEventListener("change", (e) => {
      config[`slot${idx + 1}`] = e.target.value;
      saveConfig();
      updateShortcutDockUI();
    });
  }
});

settingSensitivity.addEventListener("input", (e) => {
  config.sensitivity = parseFloat(e.target.value);
  valSensitivity.textContent = `${config.sensitivity.toFixed(1)}x`;
  saveConfig();
  sendCommand({
    type: "set_config",
    sensitivity: config.sensitivity,
    acceleration: config.accelerationEnabled,
  });
});

settingScroll.addEventListener("input", (e) => {
  config.scrollSensitivity = parseFloat(e.target.value);
  valScroll.textContent = `${config.scrollSensitivity.toFixed(1)}x`;
  saveConfig();
});

settingAcceleration.addEventListener("change", (e) => {
  config.accelerationEnabled = e.target.checked;
  saveConfig();
  sendCommand({
    type: "set_config",
    sensitivity: config.sensitivity,
    acceleration: config.accelerationEnabled,
  });
});

settingHaptic.addEventListener("change", (e) => {
  config.hapticEnabled = e.target.checked;
  saveConfig();
});

// ==========================================================================
// Magic Mouse Mode Ergonomics & Interaction Handlers
// ==========================================================================
const mmLeftClick = document.getElementById("mmLeftClick");
const mmRightClick = document.getElementById("mmRightClick");
const mmSurface = document.getElementById("mmSurface");

let mmLeftHoldTimer = null;
let mmLeftIsDragging = false;

// Magic Mouse Left Click (Instant click on tap, hold >350ms for drag-and-drop)
if (mmLeftClick) {
  mmLeftClick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    mmLeftClick.setPointerCapture(e.pointerId);
    mmLeftClick.classList.add("pressed");
    vibrate(25);
    mmLeftIsDragging = false;

    mmLeftHoldTimer = setTimeout(() => {
      mmLeftIsDragging = true;
      vibrate(60);
      sendCommand({ type: "drag_start" });
    }, 350);
  });

  function endMmLeft(e) {
    e.preventDefault();
    clearTimeout(mmLeftHoldTimer);
    mmLeftClick.classList.remove("pressed");
    if (mmLeftIsDragging) {
      mmLeftIsDragging = false;
      vibrate(30);
      sendCommand({ type: "drag_end" });
    } else {
      sendCommand({ type: "click", btn: "left" });
    }
  }

  mmLeftClick.addEventListener("pointerup", endMmLeft);
  mmLeftClick.addEventListener("pointercancel", endMmLeft);
}

// Magic Mouse Right Click
if (mmRightClick) {
  mmRightClick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    mmRightClick.classList.add("pressed");
    vibrate(35);
  });

  mmRightClick.addEventListener("pointerup", (e) => {
    e.preventDefault();
    mmRightClick.classList.remove("pressed");
    sendCommand({ type: "click", btn: "right" });
  });

  mmRightClick.addEventListener("pointercancel", (e) => {
    e.preventDefault();
    mmRightClick.classList.remove("pressed");
  });
}

// Magic Mouse Multi-Touch Surface (Pointer tracking & 2-finger scroll)
let mmPointers = new Map();
let mmLastScrollTime = 0;
let mmLastScrollDy = 0;

if (mmSurface) {
  mmSurface.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    mmSurface.setPointerCapture(e.pointerId);
    mmPointers.set(e.pointerId, { x: e.clientX, y: e.clientY, time: Date.now() });
    mmSurface.classList.add("active");
  });

  mmSurface.addEventListener("pointermove", (e) => {
    e.preventDefault();
    if (!mmPointers.has(e.pointerId)) return;

    const prev = mmPointers.get(e.pointerId);
    const now = Date.now();
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    mmPointers.set(e.pointerId, { x: e.clientX, y: e.clientY, time: now });

    const moveMag = Math.hypot(dx, dy);

    if (mmPointers.size === 1) {
      // 1-Finger glide on Magic Mouse surface: moves cursor
      if (moveMag > DEADZONE_PX) {
        const sens = config.sensitivity || 1.2;
        queueMouseMove(dx * sens, dy * sens);
      }
    } else if (mmPointers.size === 2) {
      // 2-Finger swipe on surface: scrolls smoothly
      mmLastScrollTime = now;
      mmLastScrollDy = dy;
      const scrollSens = config.scrollSensitivity || 1.0;
      queueScroll(dx * 0.1 * scrollSens, dy * 0.25 * scrollSens);
    }
  });

  function endMmSurface(e) {
    e.preventDefault();
    const wasDouble = mmPointers.size === 2;
    mmPointers.delete(e.pointerId);

    if (mmPointers.size === 0) {
      mmSurface.classList.remove("active");
    } else if (wasDouble && mmPointers.size === 1) {
      const dt = Math.max(1, Date.now() - mmLastScrollTime);
      if (dt < 80) {
        const scrollSens = config.scrollSensitivity || 1.0;
        const vy = (mmLastScrollDy / dt) * 1000 * scrollSens;
        if (Math.abs(vy) > 150) {
          sendCommand({ type: "scroll", dx: 0, dy: 0, vy: vy });
        }
      }
    }
  }

  mmSurface.addEventListener("pointerup", endMmSurface);
  mmSurface.addEventListener("pointercancel", endMmSurface);
}

// Magic Mouse Shortcut Dock Execution
function triggerShortcut(action) {
  if (!action) return;
  vibrate(30);
  sendCommand({ type: "shortcut", action: action });
}

if (mmSlot1) mmSlot1.addEventListener("click", () => triggerShortcut(config.slot1));
if (mmSlot2) mmSlot2.addEventListener("click", () => triggerShortcut(config.slot2));
if (mmSlot3) mmSlot3.addEventListener("click", () => triggerShortcut(config.slot3));
if (mmSlot4) mmSlot4.addEventListener("click", () => triggerShortcut(config.slot4));


// Text Input Modal & Voice
const textModal = document.getElementById("textModal");
const textToSend = document.getElementById("textToSend");

document.getElementById("modalCancel").addEventListener("click", () => {
  textModal.classList.remove("open");
});

document.getElementById("modalSend").addEventListener("click", () => {
  const val = textToSend.value.trim();
  if (val) {
    sendCommand({ type: "text", text: val });
    textToSend.value = "";
  }
  textModal.classList.remove("open");
});

// Speech Recognition if supported on mobile
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
document.getElementById("btnMic").addEventListener("click", () => {
  vibrate(40);

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    statusText.textContent = "Listening...";
    recognition.start();

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      statusText.textContent = "Connected";
      sendCommand({ type: "text", text: speechResult });
    };

    recognition.onerror = () => {
      statusText.textContent = "Connected";
      textModal.classList.add("open");
      textToSend.focus();
    };
  } else {
    textModal.classList.add("open");
    textToSend.focus();
  }
});

// Initialize connection
connectWebSocket();
