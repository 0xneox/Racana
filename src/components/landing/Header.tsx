"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("LandingNav");
  const th = useTranslations("Header");

  const items = [
    { label: t("howItWorks"), href: "#how" },
    { label: t("styles"), href: "#styles" },
    { label: t("pricing"), href: "#pricing" },
  ];

  return (
    <header className="absolute inset-x-0 top-0 z-50 border-b border-foreground/10 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between px-5 md:px-10 lg:px-16">
        <a href="#top" className="font-serif text-xl font-black tracking-[0.24em]">
          RACANA
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {items.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <LanguageSwitcher />
          <Link className="text-sm font-medium" href="/auth/signin">
            {th("signIn")}
          </Link>
          <Link
            className="rounded-sm border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            href="/upload"
          >
            {th("startBook")}
          </Link>
        </div>
        <button
          className="grid size-11 place-items-center md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? th("closeMenu") : th("openMenu")}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-border bg-background px-5 py-5 md:hidden">
          <div className="flex flex-col">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-3"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/auth/signin"
              onClick={() => setOpen(false)}
              className="border-b border-border py-3"
            >
              {th("signIn")}
            </Link>
            <Link
              href="/upload"
              className="mt-4 rounded-sm bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
            >
              {th("startBook")}
            </Link>
            <div className="pt-4">
              <LanguageSwitcher />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
