// Encrypts sensitive fields before they are stored (members' private phone and email), so a
// leaked database copy does not reveal them (constitution III). AES-256-GCM via Node's crypto.
//
// Stored format: "v1:" + base64(iv[12] | authTag[16] | ciphertext). The version prefix lets the
// format change later without guessing.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config.ts';

const key = Buffer.from(config.DATA_ENCRYPTION_KEY, 'base64');
const PREFIX = 'v1:';

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decrypt(stored: string): string {
  if (!stored.startsWith(PREFIX)) throw new Error('Unknown encrypted value format');
  const data = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}

/** Helpers for nullable columns. */
export const encryptOptional = (value: string | null | undefined) => (value ? encrypt(value) : null);
export const decryptOptional = (value: string | null | undefined) => (value ? decrypt(value) : null);
