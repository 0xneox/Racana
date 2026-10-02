// One canonical brand domain — set BRAND_DOMAIN (default racana.pro) and it
// flows everywhere: colophon, copyright line, watermark, emails, site copy.
export function brandDomain(): string {
  return (process.env.BRAND_DOMAIN || "racana.pro").trim() || "racana.pro";
}

export function brandSiteUrl(): string {
  return `https://${brandDomain()}`;
}

export function brandEmail(): string {
  return `books@${brandDomain()}`;
}
