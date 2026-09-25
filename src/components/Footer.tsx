const columns: [string, [string, string][]][] = [
  [
    "Product",
    [
      ["My Books", "/books"],
      ["Templates", "/templates"],
      ["Pricing", "/#pricing"],
      ["How it works", "/#how"],
    ],
  ],
  [
    "Company",
    [
      ["About", "/"],
      ["Contact", "mailto:books@racana.studio"],
    ],
  ],
  [
    "Help",
    [
      ["FAQ", "/#how"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Status", "/api/health"],
    ],
  ],
];

export function Footer() {
  return (
    <footer className="bg-foreground px-5 py-16 text-background md:px-10 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="grid gap-12 border-b border-background/20 pb-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p className="font-serif text-3xl tracking-[0.14em]">RACANA</p>
            <p className="mt-4 text-sm text-background/60">
              The 2-Minute Book Interior Publisher.
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
          <span>© 2026 Racana Studio.</span>
          <span>Your manuscript in. Your finished book out.</span>
        </div>
      </div>
    </footer>
  );
}
