// Returns true when an env var is missing or still holds a placeholder value
// from .env.example (e.g. "sk-placeholder", "re_placeholder", "whsec_placeholder").
export function isMissingOrPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return v === "" || v.includes("placeholder") || v.includes("change-me");
}

export function getAppUrl(): string {
  // NEXT_PUBLIC_* is inlined at build time — prefer server-only vars so the
  // same build artifact can be pointed at any host via runtime env.
  const url =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}
