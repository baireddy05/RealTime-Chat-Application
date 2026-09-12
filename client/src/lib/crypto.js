// Client-side End-to-End Encryption using Web Crypto API (AES-GCM 256-bit)

const E2EE_PREFIX = "[e2ee]:";

/**
 * Derive a 256-bit AES-GCM CryptoKey from a given passphrase/conversation key
 */
async function deriveKey(keyString) {
  const enc = new TextEncoder();
  const rawKeyData = enc.encode(keyString || "pulse-default-secure-vault-key");
  // Hash with SHA-256 to ensure exactly 32 bytes (256 bits)
  const hashBuffer = await crypto.subtle.digest("SHA-256", rawKeyData);
  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex) {
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
    const enc = new TextEncoder();
    const encodedData = enc.encode(text);

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
 * Decrypt cipher text using AES-GCM
 * @param {string} cipherString Encrypted string formatted as [e2ee]:<iv_hex>:<cipher_hex>
 * @param {string} keyString Shared secret or conversation key
 * @returns {Promise<string>} Decrypted plain text
 */
export async function decryptMessage(cipherString, keyString) {
  if (!isEncryptedMessage(cipherString)) return cipherString;
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

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
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
 * Generate a deterministic conversation key for 1:1 or room chats
 */
export function getConversationKey(chatTarget, currentUserId) {
  if (!chatTarget) return "pulse-default-vault";
  const targetId = chatTarget.id || chatTarget._id;
  if (chatTarget.type === "room" || (chatTarget.name && chatTarget.name.startsWith("#"))) {
    // Room channel
    return `pulse-room-key-${targetId}`;
  }
  // 1:1 direct message: sort both user IDs alphabetically so both users arrive at identical key
  const ids = [String(currentUserId), String(targetId)].sort();
  return `pulse-dm-key-${ids[0]}-${ids[1]}`;
}
