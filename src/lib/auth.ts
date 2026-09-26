import { cookies } from "next/headers";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface SessionPayload {
  user: SessionUser;
  iat: number;
  exp: number;
  /** Server-side session id (sessions table) — enables revocation. Absent on legacy stateless tokens. */
  sid?: string;
}

const SESSION_COOKIE_NAME = "mibo_session";
const DEFAULT_SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getServerSecret(): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    // Never sign sessions with a publicly-known default in production.
    throw new Error(
      "[Racana] SESSION_SECRET (or NEXTAUTH_SECRET) is required in production."
    );
  }
  return "mibo-dev-insecure-default-secret-change-me-in-prod-4a8f2c";
}

// --- base64url + hex helpers that work in Edge middleware and Node ---

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function hexDecode(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function hexEncode(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- HMAC-SHA256 via WebCrypto (works in both edge middleware and node routes) ---

async function importHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getServerSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacSign(message: string): Promise<string> {
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return hexEncode(sig);
}

async function hmacVerify(message: string, signatureHex: string): Promise<boolean> {
  try {
    const sig = hexDecode(signatureHex);
    if (!sig) return false;
    const key = await importHmacKey();
    return await crypto.subtle.verify("HMAC", key, sig, encoder.encode(message));
  } catch {
    return false;
  }
}

export async function encodeSession(
  user: SessionUser,
  ttlSec = DEFAULT_SESSION_TTL_SEC,
  sessionId?: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    user,
    iat: now,
    exp: now + ttlSec,
    ...(sessionId ? { sid: sessionId } : {}),
  };
  const b64 = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacSign(b64);
  return `${b64}.${sig}`;
}

// Stateless verification only: HMAC signature + expiry. This stays Prisma-free
// so edge middleware can use it — callers in Node routes that need revocation
// enforcement should go through `verifySessionToken` in lib/auth/session-store.
export async function decodeSessionPayload(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx < 0) return null;
  const b64 = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!b64 || !providedSig) return null;

  if (!(await hmacVerify(b64, providedSig))) return null;

  try {
    const bytes = b64urlDecode(b64);
    if (!bytes) return null;
    const payload = JSON.parse(decoder.decode(bytes)) as SessionPayload;
    if (!payload || !payload.user || typeof payload.exp !== "number") return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (!payload.user.id || !payload.user.email) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function decodeSession(token: string): Promise<SessionUser | null> {
  const payload = await decodeSessionPayload(token);
  return payload?.user ?? null;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) return null;
  return decodeSession(sessionCookie.value);
}

export function createSessionCookieValue(
  user: SessionUser,
  sessionId?: string
): Promise<string> {
  return encodeSession(user, DEFAULT_SESSION_TTL_SEC, sessionId);
}

// --- Anonymous guest sessions ---
// A signed, unguessable guest token lets authors run the full upload → preview
// flow without an account. Jobs carry guestId and are merged into the real
// user on first sign-in.

const GUEST_COOKIE_NAME = "racana_guest";
const GUEST_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

interface GuestPayload {
  guestId: string;
  iat: number;
  exp: number;
}

export async function createGuestToken(guestId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: GuestPayload = { guestId, iat: now, exp: now + GUEST_TTL_SEC };
  const b64 = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacSign(b64);
  return `${b64}.${sig}`;
}

export async function decodeGuestToken(token: string | undefined | null): Promise<string | null> {
  if (!token || typeof token !== "string") return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx < 0) return null;
  const b64 = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!b64 || !providedSig) return null;

  if (!(await hmacVerify(b64, providedSig))) return null;

  try {
    const bytes = b64urlDecode(b64);
    if (!bytes) return null;
    const payload = JSON.parse(decoder.decode(bytes)) as GuestPayload;
    if (!payload?.guestId || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.guestId;
  } catch {
    return null;
  }
}

export async function validateRequestSession(
  requestCookies: { get: (name: string) => { value: string } | undefined | null }
): Promise<SessionUser | null> {
  const cookie = requestCookies.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return null;
  return decodeSession(cookie.value);
}

export { SESSION_COOKIE_NAME, GUEST_COOKIE_NAME, GUEST_TTL_SEC, DEFAULT_SESSION_TTL_SEC };
