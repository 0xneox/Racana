// src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export const locales = ["en", "hi", "ta", "bn"] as const;
export type Locale = (typeof locales)[number];
const defaultLocale: Locale = "en";

export default getRequestConfig(async () => {
  // The middleware sets `x-next-intl-locale` on every request. When it is
  // absent (e.g. during `next build` static generation), fall back to the
  // default locale so rendering never crashes.
  const headerList = await headers();
  const requested = headerList.get("x-next-intl-locale") as Locale | null;

  const locale: Locale =
    requested && (locales as readonly string[]).includes(requested)
      ? requested
      : defaultLocale;

  // Message files live in the repo-root `messages/` directory. If a locale
  // file is ever missing, fall back to the default locale instead of
  // crashing the render.
  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../../messages/${defaultLocale}.json`)).default;
  }

  return {
    locale,
    messages,
  };
});
