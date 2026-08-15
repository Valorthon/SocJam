import assert from "node:assert/strict";
import {
  decryptToken,
  encryptToken,
  isEncryptedToken,
} from "../src/lib/tokens/crypto";

process.env.TOKEN_ENCRYPTION_KEY =
  "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";

async function run(): Promise<void> {
  const plain = "mock_test_token_123";
  const encrypted = encryptToken(plain);

  assert.ok(encrypted.startsWith("enc:"));
  assert.ok(isEncryptedToken(encrypted));
  assert.equal(decryptToken(encrypted), plain);

  // Legacy plaintext tokens should be returned as-is.
  assert.equal(decryptToken(plain), plain);
  assert.ok(!isEncryptedToken(plain));

  // Different plaintexts should produce different ciphertexts.
  const encrypted2 = encryptToken("another_token");
  assert.notEqual(encrypted, encrypted2);
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
