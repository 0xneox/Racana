import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("Errors");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl font-medium text-primary">404</h1>
        <h2 className="mt-4 font-serif text-3xl text-foreground">
          {t("notFoundTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("notFoundDesc")}
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("backToRacana")}
          </Link>
        </div>
      </div>
    </div>
  );
}
