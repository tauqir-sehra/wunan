import { describe, expect, it } from 'vitest';
import { decrypt, decryptOptional, encrypt, encryptOptional } from './crypto.ts';

describe('field encryption', () => {
  it('round-trips text, including non-ASCII', () => {
    const value = '+44 7700 900123 · Café';
    expect(decrypt(encrypt(value))).toBe(value);
  });

  it('never stores the plain value and uses a fresh IV each time', () => {
    const a = encrypt('07700 900123');
    const b = encrypt('07700 900123');
    expect(a).not.toContain('07700');
    expect(a).not.toBe(b);
  });

  it('refuses tampered data', () => {
    const stored = encrypt('secret');
    const bytes = Buffer.from(stored.slice(3), 'base64');
    bytes.writeUInt8(bytes.readUInt8(bytes.length - 1) ^ 1, bytes.length - 1);
    expect(() => decrypt('v1:' + bytes.toString('base64'))).toThrow();
  });

  it('passes empty values through as null', () => {
    expect(encryptOptional('')).toBeNull();
    expect(decryptOptional(null)).toBeNull();
  });
});
