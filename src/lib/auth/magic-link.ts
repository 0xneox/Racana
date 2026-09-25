import crypto from "crypto";
import prisma from "../db";
import { getAppUrl } from "../env";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function createMagicLink(
  email: string,
  name?: string,
  callbackUrl?: string
): Promise<{ token: string; url: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await prisma.verificationToken.create({
    data: {
      identifier: email.toLowerCase(),
      tokenHash,
      name: name || null,
      callbackUrl: callbackUrl || null,
      expiresAt,
    },
  });

  const url = `${getAppUrl()}/api/auth/verify?token=${token}`;
  return { token, url, expiresAt };
}

export interface VerifiedToken {
  email: string;
  name: string | null;
  callbackUrl: string | null;
}

// Single-use: the token is marked consumed inside this call.
export async function consumeMagicLinkToken(
  token: string
): Promise<VerifiedToken | null> {
  if (!token || typeof token !== "string") return null;
  const tokenHash = sha256(token);

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash },
  });
  if (!record) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt < new Date()) return null;

  await prisma.verificationToken.update({
    where: { tokenHash },
    data: { consumedAt: new Date() },
  });

  return {
    email: record.identifier,
    name: record.name || null,
    callbackUrl: record.callbackUrl || null,
  };
}

// Prevent open redirects: only allow same-origin relative callback paths.
export function sanitizeCallbackUrl(raw: string | null | undefined): string {
  if (!raw) return "/upload";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/upload";
}
