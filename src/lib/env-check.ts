import { isMissingOrPlaceholder } from "./env";

function missingStorageEnv(): string[] {
  const missing: string[] = [];
  if (
    isMissingOrPlaceholder(process.env.S3_ENDPOINT) ||
    isMissingOrPlaceholder(process.env.S3_ACCESS_KEY) ||
    isMissingOrPlaceholder(process.env.S3_SECRET_KEY)
  ) {
    missing.push("S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY");
  }
  return missing;
}

export function assertWorkerEnv(): void {
  const missing: string[] = [];
  if (isMissingOrPlaceholder(process.env.DATABASE_URL)) missing.push("DATABASE_URL");
  if (isMissingOrPlaceholder(process.env.REDIS_URL)) missing.push("REDIS_URL");
  missing.push(...missingStorageEnv());

  if (missing.length > 0) {
    throw new Error(`[Racana worker] Refusing to start — missing required env vars: ${missing.join(", ")}`);
  }
}

// Hard-fail at boot rather than serving a broken app: a missing session secret
// means forgeable sessions, a missing DATABASE_URL means every request fails,
// and with no email + no OAuth nobody can sign in at all.
export function assertProductionEnv(): void {
  const missing: string[] = [];

  if (isMissingOrPlaceholder(process.env.DATABASE_URL)) {
    missing.push("DATABASE_URL");
  }

  if (
    isMissingOrPlaceholder(process.env.SESSION_SECRET) &&
    isMissingOrPlaceholder(process.env.NEXTAUTH_SECRET)
  ) {
    missing.push("SESSION_SECRET (or NEXTAUTH_SECRET)");
  }

  const hasEmail = !isMissingOrPlaceholder(process.env.RESEND_API_KEY);
  const hasGoogle =
    !isMissingOrPlaceholder(process.env.GOOGLE_CLIENT_ID) &&
    !isMissingOrPlaceholder(process.env.GOOGLE_CLIENT_SECRET);
  if (!hasEmail && !hasGoogle) {
    missing.push("RESEND_API_KEY (magic-link email) or GOOGLE_CLIENT_ID/SECRET (OAuth)");
  }

  if (
    isMissingOrPlaceholder(process.env.APP_URL) &&
    isMissingOrPlaceholder(process.env.NEXTAUTH_URL) &&
    isMissingOrPlaceholder(process.env.NEXT_PUBLIC_APP_URL)
  ) {
    missing.push("APP_URL (or NEXTAUTH_URL / NEXT_PUBLIC_APP_URL)");
  }

  if (isMissingOrPlaceholder(process.env.REDIS_URL)) {
    missing.push("REDIS_URL");
  }

  missing.push(...missingStorageEnv());

  if (
    isMissingOrPlaceholder(process.env.RAZORPAY_KEY_ID) ||
    isMissingOrPlaceholder(process.env.RAZORPAY_KEY_SECRET) ||
    isMissingOrPlaceholder(process.env.RAZORPAY_WEBHOOK_SECRET)
  ) {
    missing.push("RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(
      `[Racana] Refusing to boot — missing required production env vars: ${missing.join(", ")}`
    );
  }
}
