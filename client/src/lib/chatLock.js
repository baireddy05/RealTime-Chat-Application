// Device-local chat lock: chats can be locked behind a 4-digit PIN.
// The PIN itself is stored only as a salted SHA-256 hash; the locked id list
// is plain localStorage (hiding existence is not a goal — hiding content is).

const PIN_KEY = "pulse-chat-lock-pin";
const LOCKED_KEY = "pulse-locked-chats";
const PIN_SALT = "pulse-chat-lock:";

const readIds = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCKED_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((v) => (typeof v === "string" ? v : String(v ?? "")))
      .map((s) => s.trim())
      .filter((s) => s && s !== "null" && s !== "undefined");
  } catch {
    return [];
  }
};

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PIN_SALT + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const hasChatPin = () => {
  try {
    return !!localStorage.getItem(PIN_KEY);
  } catch {
    return false;
  }
};

export const setChatPin = async (pin) => {
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
  const hash = await sha256Hex(pin);
  try {
    localStorage.setItem(PIN_KEY, hash);
  } catch {}
};

export const clearChatPin = () => {
  try {
    localStorage.removeItem(PIN_KEY);
    // Without a PIN nothing locked can ever open — release all locks too.
    localStorage.setItem(LOCKED_KEY, "[]");
  } catch {}
};

export const verifyChatPin = async (pin) => {
  try {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return false;
    return (await sha256Hex(pin)) === stored;
  } catch {
    return false;
  }
};

export const getLockedChats = () => readIds();

export const isChatLocked = (chatId) => {
  if (!chatId) return false;
  return readIds().includes(String(chatId));
};

// Cross-device lock flag (server chatPreferences): a chat locked on one device
// shows the PIN gate on this device too. The PIN hash itself stays local —
// each device sets its own PIN in Settings → Privacy.
export const isChatLockedRemote = (chatId, prefs) => {
  if (!chatId || !prefs || typeof prefs !== "object") return false;
  return prefs[String(chatId)]?.locked === true;
};

// Locked here OR locked on another device (and not unlocked this session).
export const isChatLockedAnywhere = (chatId, prefs, unlockedIds = []) => {
  if (!chatId) return false;
  const id = String(chatId);
  if ((unlockedIds || []).map(String).includes(id)) return false;
  return isChatLocked(id) || isChatLockedRemote(id, prefs);
};

export const setChatLocked = (chatId, locked) => {
  if (!chatId) return;
  const id = String(chatId);
  const next = locked ? [...new Set([...readIds(), id])] : readIds().filter((x) => x !== id);
  try {
    localStorage.setItem(LOCKED_KEY, JSON.stringify(next));
  } catch {}
};
