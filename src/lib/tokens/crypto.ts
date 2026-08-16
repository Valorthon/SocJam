import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ENCRYPTION_PREFIX = "enc:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured.");
  }

  const normalized = raw.trim();
  if (normalized.length === 64) {
    const key = Buffer.from(normalized, "hex");
    if (key.length === KEY_LENGTH) {
      return key;
    }
  }

  // Derive a 32-byte key from an arbitrary secret using scrypt.
  return scryptSync(normalized, "socjam-token-salt", KEY_LENGTH);
}

function toBase64(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function fromBase64(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptToken(plain: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${toBase64(iv)}:${toBase64(authTag)}:${toBase64(
    ciphertext,
  )}`;
}

export function decryptToken(cipher: string): string {
  if (!cipher.startsWith(ENCRYPTION_PREFIX)) {
    // Legacy plaintext token: return as-is so existing mock accounts keep
    // working. The next write will encrypt it.
    return cipher;
  }

  const payload = cipher.slice(ENCRYPTION_PREFIX.length);
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format.");
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = fromBase64(ivBase64);
  const authTag = fromBase64(authTagBase64);
  const ciphertext = fromBase64(ciphertextBase64);

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted token components.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(ENCRYPTION_PREFIX);
}
