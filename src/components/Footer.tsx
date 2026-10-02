import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("Footer");
  const th = useTranslations("Header");

  const columns: [string, [string, string][]][] = [
    [
      t("product"),
      [
        [th("myBooks"), "/books"],
        [t("styles"), "/#styles"],
        [t("pricing"), "/#pricing"],
        [t("howItWorks"), "/#how"],
      ],
    ],
    [
      t("company"),
      [
        [t("contact"), "mailto:books@racana.pro"],
      ],
    ],
    [
      t("help"),
      [
        [t("faq"), "/#faq"],
        [t("privacy"), "/privacy"],
        [t("terms"), "/terms"],
      ],
    ],
  ];

  return (
    <footer className="bg-foreground px-5 py-16 text-background md:px-10 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="grid gap-12 border-b border-background/20 pb-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src="/logo-mark.png" alt="" className="h-10 w-auto" />
              <p className="font-serif text-3xl tracking-[0.14em]">RACANA</p>
            </div>
            <p className="mt-4 text-sm text-background/60">
              {t("tagline")}
            </p>
          </div>
          {columns.map(([heading, links]) => (
            <div key={heading}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-background/50">
                {heading}
              </p>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                {links.map(([label, href]) => (
                  <a key={label} href={href}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-between gap-3 pt-6 text-xs text-background/50 sm:flex-row">
          <span>{t("copyright")}</span>
          <span>{t("slogan")}</span>
        </div>
      </div>
    </footer>
  );
}
