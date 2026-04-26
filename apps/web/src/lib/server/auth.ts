import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  userId: string;
  accountId: string;
  email: string;
  exp: number;
};

function sign(value: string): string {
  return createHmac('sha256', env().SESSION_SECRET).update(value).digest('base64url');
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function decodeSession(cookie: string | undefined): SessionPayload | null {
  if (!cookie) return null;
  const parts = cookie.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newSession(input: Omit<SessionPayload, 'exp'>): SessionPayload {
  return { ...input, exp: Date.now() + SESSION_TTL_MS };
}

export function generateOpaqueToken(byteLen = 32): string {
  return randomBytes(byteLen).toString('base64url');
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
