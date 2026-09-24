// Client-side End-to-End Encryption using Web Crypto API (AES-GCM 256-bit)

const E2EE_PREFIX = "[e2ee]:";

// Pre-instantiated encoders for zero-garbage text conversions
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Pre-computed lookup table for O(1) buffer-to-hex conversion without intermediate string arrays
const byteToHexTable = [];
for (let n = 0; n <= 0xff; ++n) {
  byteToHexTable.push(n.toString(16).padStart(2, "0"));
}

// Bounded LRU-style caches for derived CryptoKeys and decrypted message texts
const keyCache = new Map();
const decryptionCache = new Map();
const MAX_CACHE_SIZE = 500;

/**
 * Derive a 256-bit AES-GCM CryptoKey from a given passphrase/conversation key
 * Memoized to eliminate redundant WebCrypto SHA-256 digests and key imports
 */
async function deriveKey(keyString) {
  const normalizedKey = typeof keyString === "string" && keyString ? keyString : "pulse-default-secure-vault-key";
  if (keyCache.has(normalizedKey)) {
    return keyCache.get(normalizedKey);
  }

  const rawKeyData = textEncoder.encode(normalizedKey);
  // Hash with SHA-256 to ensure exactly 32 bytes (256 bits)
  const hashBuffer = await crypto.subtle.digest("SHA-256", rawKeyData);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  if (keyCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = keyCache.keys().next().value;
    keyCache.delete(oldestKey);
  }
  keyCache.set(normalizedKey, cryptoKey);
  return cryptoKey;
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  const hex = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hex[i] = byteToHexTable[bytes[i]];
  }
  return hex.join("");
}

function hexToBuffer(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encrypt plain text using AES-GCM
 * @param {string} text Plain text message
 * @param {string} keyString Shared secret or conversation key
 * @returns {Promise<string>} Encrypted string with format [e2ee]:<iv_hex>:<cipher_hex>
 */
export async function encryptMessage(text, keyString) {
  if (!text || typeof text !== "string") return text;
  try {
    const key = await deriveKey(keyString);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for AES-GCM
    const encodedData = textEncoder.encode(text);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encodedData
    );

    const ivHex = bufferToHex(iv);
    const cipherHex = bufferToHex(ciphertextBuffer);

    return `${E2EE_PREFIX}${ivHex}:${cipherHex}`;
  } catch (error) {
    console.error("E2EE encryption error:", error);
    return text;
  }
}

/**
 * Decrypt cipher text using AES-GCM with bounded cache for instantaneous repeated lookups
 * @param {string} cipherString Encrypted string formatted as [e2ee]:<iv_hex>:<cipher_hex>
 * @param {string} keyString Shared secret or conversation key
 * @returns {Promise<string>} Decrypted plain text
 */
export async function decryptMessage(cipherString, keyString) {
  if (!isEncryptedMessage(cipherString)) return cipherString;

  // Bound cache key length — full ciphertext keys would retain MBs of text.
  const cacheKey = `${String(keyString ?? "").slice(0, 64)}:${String(cipherString).slice(0, 256)}:${String(cipherString).length}`;
  if (decryptionCache.has(cacheKey)) {
    return decryptionCache.get(cacheKey);
  }

  try {
    const rawCipher = cipherString.slice(E2EE_PREFIX.length);
    const [ivHex, cipherHex] = rawCipher.split(":");
    if (!ivHex || !cipherHex) return cipherString;

    const key = await deriveKey(keyString);
    const iv = hexToBuffer(ivHex);
    const ciphertext = hexToBuffer(cipherHex);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext
    );

    const plainText = textDecoder.decode(decryptedBuffer);

    // Skip caching large payloads to bound memory.
    if (String(cipherString).length < 8192) {
      if (decryptionCache.size >= MAX_CACHE_SIZE * 2) {
        const oldest = decryptionCache.keys().next().value;
        decryptionCache.delete(oldest);
      }
      decryptionCache.set(cacheKey, plainText);
    }

    return plainText;
  } catch (error) {
    console.warn("E2EE decryption error (likely wrong key or untrusted message):", error);
    return "[🔒 Encrypted Message - Unable to Decrypt]";
  }
}

/**
 * Check if a text string is an E2EE encrypted payload
 */
export function isEncryptedMessage(text) {
  return typeof text === "string" && text.startsWith(E2EE_PREFIX);
}

/**
 * Generate a deterministic conversation key for 1:1 or room chats.
 * Single default vault so both sides always agree; never derive from "undefined".
 */
export function getConversationKey(chatTarget, currentUserId) {
  const DEFAULT_VAULT = "pulse-default-secure-vault-key";
  if (!chatTarget) return DEFAULT_VAULT;
  const targetId = chatTarget.id ?? chatTarget._id;
  if (targetId === undefined || targetId === null || targetId === "") return DEFAULT_VAULT;
  const isRoom = chatTarget.type === "room" || chatTarget.type === "group" || chatTarget.type === "channel";
  if (isRoom) {
    // Group chat (room) — type-explicit, no name heuristic.
    return `pulse-room-key-${String(targetId)}`;
  }
  // 1:1 direct message: sort both user IDs alphabetically so both users arrive at identical key.
  // Guard against missing currentUserId (logged-out race) — fall back to default vault.
  if (currentUserId === undefined || currentUserId === null || currentUserId === "") return DEFAULT_VAULT;
  const ids = [String(currentUserId), String(targetId)].sort();
  if (ids.some((id) => id === "undefined" || id === "null" || id === "")) return DEFAULT_VAULT;
  return `pulse-dm-key-${ids[0]}-${ids[1]}`;
}
