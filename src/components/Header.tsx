"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function Header() {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);

  const navItems = [
    { label: t('overview'), href: '/' },
    { label: t('newBook'), href: '/upload' },
    { label: t('myBooks'), href: '/books' },
  ];

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between px-5 md:px-10 lg:px-16">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-serif text-xl font-black tracking-[0.24em]"
        >
          <img src="/logo-mark.png" alt="" className="h-9 w-auto" />
          RACANA
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "text-foreground"
                    : "text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <LanguageSwitcher />
          {user ? (
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <User className="size-3.5" />
                {user.name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
                title={t('signOut')}
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          ) : (
            <>
              <Link className="text-sm font-medium" href="/auth/signin">
                {t('signIn')}
              </Link>
              <Link
                className="rounded-sm border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                href="/upload"
              >
                {t('startBook')}
              </Link>
            </>
          )}
        </div>

        <button
          className="grid size-11 place-items-center md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? t('closeMenu') : t('openMenu')}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-5 py-5 md:hidden">
          <div className="flex flex-col">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-3"
              >
                {item.label}
              </Link>
            ))}
            <div className="border-b border-border py-3">
              <LanguageSwitcher />
            </div>
            {user ? (
              <button
                onClick={handleSignOut}
                className="mt-4 rounded-sm border border-primary px-5 py-3 text-center text-sm font-semibold text-primary"
              >
                {t('signOut')}
              </button>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  onClick={() => setOpen(false)}
                  className="border-b border-border py-3"
                >
                  {t('signIn')}
                </Link>
                <Link
                  href="/upload"
                  className="mt-4 rounded-sm bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
                >
                  {t('startBook')}
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
