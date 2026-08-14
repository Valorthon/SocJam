import assert from "node:assert/strict";
import {
  decryptToken,
  encryptToken,
  EncryptionConfigError,
  generateEncryptionKey,
  isEncryptionConfigured,
} from "../src/lib/crypto";

const KEY = generateEncryptionKey();

async function run(): Promise<void> {
  // Missing key → EncryptionConfigError on use.
  const originalKey = process.env.APP_ENCRYPTION_KEY;
  delete process.env.APP_ENCRYPTION_KEY;

  try {
    encryptToken("hello");
    assert.fail("encryptToken should throw without a key");
  } catch (error) {
    assert.ok(error instanceof EncryptionConfigError);
  }
  assert.equal(isEncryptionConfigured(), false);

  // Bad key shape → error too.
  process.env.APP_ENCRYPTION_KEY = "not-32-bytes";
  try {
    encryptToken("hello");
    assert.fail("encryptToken should throw with a malformed key");
  } catch (error) {
    assert.ok(error instanceof EncryptionConfigError);
  }

  // Configure for the rest of the suite.
  process.env.APP_ENCRYPTION_KEY = KEY;
  assert.equal(isEncryptionConfigured(), true);

  // Round trip preserves plaintext.
  const plaintext = "EAABsecret_facebook_page_token_123456";
  const ciphertext = encryptToken(plaintext);
  assert.notEqual(ciphertext, plaintext, "ciphertext must not equal plaintext");
  assert.equal(decryptToken(ciphertext), plaintext);

  // Each call produces a fresh ciphertext (random IV).
  const second = encryptToken(plaintext);
  assert.notEqual(second, ciphertext);
  assert.equal(decryptToken(second), plaintext);

  // Tamper detection: flipping a byte in the ciphertext must fail.
  const tampered = Buffer.from(ciphertext, "base64");
  tampered[tampered.length - 1] ^= 0x01;
  try {
    decryptToken(tampered.toString("base64"));
    assert.fail("tampered authTag should fail decryption");
  } catch (error) {
    assert.ok(error instanceof EncryptionConfigError);
  }

  // Empty plaintext rejected.
  try {
    encryptToken("");
    assert.fail("encryptToken rejects empty string");
  } catch (error) {
    assert.ok(error instanceof EncryptionConfigError);
  }

  // Hex key works too.
  process.env.APP_ENCRYPTION_KEY = "0".repeat(64);
  assert.equal(decryptToken(encryptToken("hex")), "hex");

  process.env.APP_ENCRYPTION_KEY = KEY;

  // Different keys can't decrypt each other's ciphertext.
  const withKeyA = encryptToken("cross-key");
  process.env.APP_ENCRYPTION_KEY = generateEncryptionKey();
  try {
    decryptToken(withKeyA);
    assert.fail("decryptToken should fail under a different key");
  } catch (error) {
    assert.ok(error instanceof EncryptionConfigError);
  }
  process.env.APP_ENCRYPTION_KEY = KEY;

  console.log("Crypto tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});