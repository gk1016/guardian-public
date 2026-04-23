/**
 * TOTP implementation (RFC 6238) using Node crypto.
 * Zero external dependencies.
 */
import { createHmac, randomBytes } from "crypto";

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";

/** Generate a random base32-encoded TOTP secret. */
export function generateSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes);
}

/** Generate the otpauth:// URI for QR code scanning. */
export function totpUri(params: {
  secret: string;
  account: string;
  issuer: string;
}): string {
  const encoded = encodeURIComponent;
  return `otpauth://totp/${encoded(params.issuer)}:${encoded(params.account)}?secret=${params.secret}&issuer=${encoded(params.issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/** Verify a TOTP code, allowing +/- 1 window for clock skew. */
export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let offset = -1; offset <= 1; offset++) {
    const counter = Math.floor((now + offset * TOTP_PERIOD) / TOTP_PERIOD);
    if (generateCode(secret, counter) === code) return true;
  }
  return false;
}

function generateCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // Write counter as big-endian 64-bit
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);

  const hmac = createHmac(TOTP_ALGORITHM, key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

// --- Base32 helpers ---
const B32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += B32_CHARS[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += B32_CHARS[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/=+$/, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of cleaned) {
    const idx = B32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}
