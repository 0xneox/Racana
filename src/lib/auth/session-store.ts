// Server-side session registry (Node runtime only — do NOT import from edge
// middleware; lib/auth.ts must stay Prisma-free for that reason).
//
// The session cookie still carries the HMAC-signed payload, but it now embeds
// a `sid` pointing at a row in the `sessions` table. Revocation = setting
// revokedAt, so a stolen cookie can be killed server-side and sign-out
// genuinely invalidates the session rather than just deleting the cookie.
//
// Availability posture: stateless crypto checks are always authoritative for
// signature + expiry. The DB is only consulted for revocation — if the
// database is unreachable we fail OPEN (cookie still accepted) so a transient
// outage can't lock every signed-in user out.

import crypto from "crypto";
import prisma from "../db";
import {
  createSessionCookieValue,
  decodeSessionPayload,
  DEFAULT_SESSION_TTL_SEC,
  type SessionUser,
} from "../auth";

function logSessionError(prefix: string, err: unknown) {
  const ts = new Date().toISOString();
  const msg = err instanceof Error ? err.stack || err.message : String(err);
  console.error(`[${ts}] ${prefix} :: ${msg}`);
}

// Creates a sessions row and returns the signed cookie value carrying its id.
// If the DB write fails, returns a stateless (sid-less) cookie instead — a
// session-store hiccup must not block sign-in.
export async function createServerSession(
  user: SessionUser,
  ttlSec = DEFAULT_SESSION_TTL_SEC
): Promise<string> {
  const sessionId = crypto.randomUUID();
  try {
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt: new Date(Date.now() + ttlSec * 1000),
      },
    });
  } catch (err) {
    logSessionError("SessionStore Create", err);
    return createSessionCookieValue(user);
  }
  return createSessionCookieValue(user, sessionId);
}

// Stateless HMAC verify + DB revocation check. Returns the user, or null if
// the token is invalid, expired, revoked, or references a session row that no
// longer exists. DB errors fail open (treated as still valid).
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const payload = await decodeSessionPayload(token);
  if (!payload) return null;

  // Legacy tokens issued before server-side sessions have no sid — accept
  // them on crypto+expiry alone so existing sign-ins survive the rollout.
  if (!payload.sid) return payload.user;

  try {
    const record = await prisma.session.findUnique({
      where: { id: payload.sid },
    });
    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return null;
    return payload.user;
  } catch (err) {
    logSessionError("SessionStore Verify", err);
    return payload.user;
  }
}

// Revokes the session referenced by a cookie token. No-op for legacy sid-less
// tokens or when the row is already revoked. Never throws — sign-out should
// always clear the cookie even if revocation can't be persisted.
export async function revokeSessionToken(
  token: string | undefined | null
): Promise<void> {
  if (!token) return;
  const payload = await decodeSessionPayload(token);
  if (!payload?.sid) return;
  try {
    await prisma.session.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (err) {
    logSessionError("SessionStore Revoke", err);
  }
}

// Revokes every live session for a user (e.g. "sign out everywhere" after a
// suspected account compromise).
export async function revokeAllUserSessions(userId: string): Promise<void> {
  try {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (err) {
    logSessionError("SessionStore RevokeAll", err);
  }
}
