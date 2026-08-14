import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Symmetric encryption used to protect real OAuth access/refresh tokens at rest
 * (SPEC §6: "encrypt at rest before real OAuth"). Uses AES-256-GCM with a
 * shared 32-byte key supplied via `APP_ENCRYPTION_KEY` (base64 or hex). Each
 * ciphertext is prefixed by a random 12-byte IV and includes a 16-byte GMAC
 * auth tag, so tampering is detected on decrypt.
 *
 * Layout of the returned base64 string:
 *   base64( iv[12] || ciphertext || authTag[16] )
 */

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class EncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionConfigError";
  }
}

function toBytes(value: string, label: string): Buffer {
  // Accept hex (64 chars) or base64 (44 chars incl. padding) of a 32-byte key.
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 32) {
    return decoded;
  }

  throw new EncryptionConfigError(
    `${label} must be a 32-byte key encoded as base64 or hex.`,
  );
}

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw || raw.trim() === "") {
    throw new EncryptionConfigError(
      "APP_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.",
    );
  }

  return toBytes(raw, "APP_ENCRYPTION_KEY");
}

export function isEncryptionConfigured(): boolean {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw || raw.trim() === "") return false;
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}

export function encryptToken(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new EncryptionConfigError("encryptToken requires a non-empty string.");
  }

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, ciphertext, authTag]).toString("base64");
}

export function decryptToken(encoded: string): string {
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new EncryptionConfigError("decryptToken requires a non-empty string.");
  }

  const key = getKey();
  const blob = Buffer.from(encoded, "base64");
  const minLen = IV_LENGTH + AUTH_TAG_LENGTH;
  if (blob.length < minLen) {
    throw new EncryptionConfigError("Encrypted token is corrupt.");
  }

  const iv = blob.subarray(0, IV_LENGTH);
  const authTag = blob.subarray(blob.length - AUTH_TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH, blob.length - AUTH_TAG_LENGTH);

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new EncryptionConfigError("Encrypted token is corrupt.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new EncryptionConfigError(
      "Unable to decrypt token — key mismatch or tampering detected.",
    );
  }
}