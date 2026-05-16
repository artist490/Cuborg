const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const AES_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const AES_GCM_IV_LENGTH = 12;
const DEFAULT_SALT_LENGTH = 32;
const AUTH_SENTINEL = "VAULT_OK";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function assertWebCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto API is unavailable in this browser context.");
  }
}

function normalizeBytes(value, label = "value") {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  throw new TypeError(`${label} must be a Uint8Array, ArrayBuffer, or typed array.`);
}

function bytesToBase64(bytes) {
  const normalized = normalizeBytes(bytes, "bytes");
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64) {
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new TypeError("Base64 input must be a non-empty string.");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getRandomBytes(length) {
  assertWebCrypto();

  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError("Random byte length must be a positive integer.");
  }

  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function parseEncryptedPayload(payload) {
  if (typeof payload !== "string") {
    throw new TypeError("Encrypted payload must be a string.");
  }

  const parts = payload.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Encrypted payload must use the format IV_in_Base64.Ciphertext_in_Base64.");
  }

  return {
    iv: base64ToBytes(parts[0]),
    ciphertext: base64ToBytes(parts[1]),
  };
}

export function createSalt(length = DEFAULT_SALT_LENGTH) {
  return getRandomBytes(length);
}

export function createSaltBase64(length = DEFAULT_SALT_LENGTH) {
  return bytesToBase64(createSalt(length));
}

export function createIv() {
  return getRandomBytes(AES_GCM_IV_LENGTH);
}

export function bytesToB64(bytes) {
  return bytesToBase64(bytes);
}

export function b64ToBytes(base64) {
  return base64ToBytes(base64);
}

export async function deriveKey(masterPassword, salt) {
  assertWebCrypto();

  if (typeof masterPassword !== "string" || masterPassword.length === 0) {
    throw new TypeError("Master password must be a non-empty string.");
  }

  const saltBytes = typeof salt === "string" ? base64ToBytes(salt) : normalizeBytes(salt, "salt");
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    {
      name: AES_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(plaintext, key) {
  assertWebCrypto();

  if (typeof plaintext !== "string") {
    throw new TypeError("Plaintext must be a string.");
  }

  const iv = createIv();
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: AES_ALGORITHM,
      iv,
    },
    key,
    textEncoder.encode(plaintext),
  );

  return `${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

export async function decryptString(encryptedPayload, key) {
  assertWebCrypto();

  const { iv, ciphertext } = parseEncryptedPayload(encryptedPayload);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    {
      name: AES_ALGORITHM,
      iv,
    },
    key,
    ciphertext,
  );

  return textDecoder.decode(plaintext);
}

export async function createAuthVerifier(masterPassword) {
  const salt = createSalt();
  const key = await deriveKey(masterPassword, salt);
  const verifier = await encryptString(AUTH_SENTINEL, key);

  return {
    salt: bytesToBase64(salt),
    verifier,
    key,
  };
}

export async function unlockWithVerifier(masterPassword, saltBase64, verifier) {
  const key = await deriveKey(masterPassword, saltBase64);
  const decrypted = await decryptString(verifier, key);

  if (decrypted !== AUTH_SENTINEL) {
    throw new Error("Invalid master password.");
  }

  return key;
}

export async function canUnlock(masterPassword, saltBase64, verifier) {
  try {
    await unlockWithVerifier(masterPassword, saltBase64, verifier);
    return true;
  } catch {
    return false;
  }
}

export function getCryptoConfig() {
  return Object.freeze({
    pbkdf2Iterations: PBKDF2_ITERATIONS,
    pbkdf2Hash: PBKDF2_HASH,
    aesAlgorithm: AES_ALGORITHM,
    aesKeyLength: AES_KEY_LENGTH,
    aesGcmIvLength: AES_GCM_IV_LENGTH,
    defaultSaltLength: DEFAULT_SALT_LENGTH,
    authSentinel: AUTH_SENTINEL,
    storageFormat: "IV_in_Base64.Ciphertext_in_Base64",
  });
}
