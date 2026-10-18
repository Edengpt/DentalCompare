import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption at rest for patients' medical files.
 *
 * What it protects against: someone who gets hold of the blob store alone — a
 * leaked storage token, a misconfigured bucket, a provider-side incident. They
 * get ciphertext. It does NOT protect against someone who controls the running
 * app, because the key lives in the app's environment; nothing short of
 * end-to-end encryption would.
 *
 * Format, version 1:  "DCE1" | 12-byte IV | 16-byte GCM tag | ciphertext
 *
 * The magic is how a reader tells an encrypted file from one stored before
 * encryption existed. Those are served as they are until retention removes
 * them, so there is no flag day and no backfill to get wrong.
 */

const MAGIC = Buffer.from("DCE1", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + IV_BYTES + TAG_BYTES;

/** The 32-byte key, or null when none is configured (local dev, CI). */
export function fileEncryptionKey(
  raw: string | undefined = process.env.FILE_ENCRYPTION_KEY,
): Buffer | null {
  if (!raw?.trim()) return null;
  const key = Buffer.from(raw.trim(), "base64");
  // A wrong-length key is a configuration error, not "no key": falling back to
  // plaintext here would quietly store medical files unencrypted.
  if (key.length !== 32) throw new Error("FILE_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function isEncryptedFile(data: Uint8Array): boolean {
  return data.length >= HEADER_BYTES && MAGIC.equals(Buffer.from(data.subarray(0, MAGIC.length)));
}

export function encryptFile(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

/**
 * The file's plaintext. A file without the header predates encryption and is
 * returned unchanged; an encrypted one with no key, or one that fails its
 * authentication tag, throws — never hand out bytes that may be tampered with.
 */
export function decryptFile(data: Buffer, key: Buffer | null = fileEncryptionKey()): Buffer {
  if (!isEncryptedFile(data)) return data;
  if (!key) throw new Error("encrypted file but FILE_ENCRYPTION_KEY is not set");
  const iv = data.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = data.subarray(MAGIC.length + IV_BYTES, HEADER_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(HEADER_BYTES)), decipher.final()]);
}
