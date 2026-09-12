// Aether Web Remote Controller Client - Phase 3 + Settings Persistence

const CONFIG_STORAGE_KEY = "aether_web_config";

// Default settings
let config = {
  host: window.location.hostname || "127.0.0.1",
  wsPort: 53821,
  sensitivity: 1.2,
  scrollSensitivity: 1.0,
  accelerationEnabled: true,
  hapticEnabled: true,
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

function updateSettingsUI() {
  settingHost.value = config.host;
  settingSensitivity.value = config.sensitivity;
  settingScroll.value = config.scrollSensitivity;
  settingAcceleration.checked = config.accelerationEnabled;
  settingHaptic.checked = config.hapticEnabled;
  valSensitivity.textContent = `${Number(config.sensitivity).toFixed(1)}x`;
  valScroll.textContent = `${Number(config.scrollSensitivity).toFixed(1)}x`;
}

updateSettingsUI();

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
  const currentHost = config.host || window.location.hostname || "127.0.0.1";
  const wsUrl = `ws://${currentHost}:${config.wsPort}`;
  statusText.textContent = "Connecting...";
  statusDot.className = "status-dot reconnecting";

  try {
    if (socket) {
      socket.close();
    }
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      isConnected = true;
      statusText.textContent = "Connected";
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
      statusText.textContent = "Reconnecting...";
      statusDot.className = "status-dot reconnecting";
      setTimeout(connectWebSocket, 2000);
    };

    socket.onerror = () => {
      socket.close();
    };
  } catch (e) {
    setTimeout(connectWebSocket, 2000);
  }
}

function sendCommand(cmd) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(cmd));
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
      sendCommand({ type: "move", dx: dx * sens, dy: dy * sens });
    }
  } else if (activePointers.size === 2) {
    // 2-Finger scroll scaled by user scroll sensitivity
    clearTimeout(longPressTimer);
    lastScrollTime = now;
    lastScrollDy = dy;
    const scrollSens = config.scrollSensitivity || 1.0;
    sendCommand({
      type: "scroll",
      dx: dx * 0.1 * scrollSens,
      dy: dy * 0.25 * scrollSens,
    });
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
  saveConfig();
  closeSettings();

  if (hostChanged) {
    connectWebSocket();
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
