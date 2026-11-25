const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function randomHex(byteLength: number): string {
  return bytesToHex(randomBytes(byteLength));
}

export function makeId(prefix: string): string {
  return `${prefix}_${randomHex(6)}`;
}

export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(input: string): Uint8Array | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPasswordWeb(password: string): Promise<string> {
  const salt = randomBytes(16);
  const saltHex = bytesToHex(salt);
  const iterations = 100_000;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  const derivedHex = bytesToHex(new Uint8Array(bits));
  return `pbkdf2_sha256$${iterations}$${saltHex}$${derivedHex}`;
}

export async function verifyPasswordWeb(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('pbkdf2_sha256$')) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  const salt = hexToBytes(parts[2]);
  const expected = hexToBytes(parts[3]);
  if (!Number.isFinite(iterations) || iterations < 1000 || !salt || !expected) {
    return false;
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    expected.length * 8,
  );
  return timingSafeEqualBytes(new Uint8Array(bits), expected);
}

export interface TokenPayload {
  userId: string;
  exp: number;
  epoch?: number;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(sig);
}

export async function signTokenWeb(userId: string, secret: string, epoch = 1): Promise<string> {
  const payload: TokenPayload = {
    userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    epoch: Number.isFinite(epoch) && epoch >= 1 ? Math.floor(epoch) : 1,
  };
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const sigBytes = await hmacSha256(secret, body);
  return `${body}.${bytesToBase64Url(sigBytes)}`;
}

export async function verifyTokenWeb(token: string, secret: string): Promise<TokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const providedSigBytes = base64UrlToBytes(sig);
  if (!providedSigBytes) return null;
  const expectedSigBytes = await hmacSha256(secret, body);
  if (!timingSafeEqualBytes(providedSigBytes, expectedSigBytes)) {
    return null;
  }
  const bodyBytes = base64UrlToBytes(body);
  if (!bodyBytes) return null;
  try {
    const parsed = JSON.parse(decoder.decode(bodyBytes)) as TokenPayload;
    if (!parsed.userId || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildCredentialFromTemplateWeb(template: string): string {
  const key4 = () => randomHex(2).toUpperCase();
  const rand4 = () => {
    const num = new Uint32Array(1);
    crypto.getRandomValues(num);
    return String(1000 + (num[0] % 9000));
  };
  return template
    .replace(/\{\{KEY4\}\}/g, () => key4())
    .replace(/\{\{RAND4\}\}/g, () => rand4());
}
