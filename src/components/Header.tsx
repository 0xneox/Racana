"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, User, X } from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Overview", href: "/" },
  { label: "New Book", href: "/upload" },
  { label: "My Books", href: "/books" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);

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
          className="font-serif text-xl font-black tracking-[0.24em]"
        >
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
          {user ? (
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <User className="size-3.5" />
                {user.name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
                title="Sign Out"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          ) : (
            <>
              <Link className="text-sm font-medium" href="/auth/signin">
                Sign in
              </Link>
              <Link
                className="rounded-sm border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                href="/upload"
              >
                Start a book
              </Link>
            </>
          )}
        </div>

        <button
          className="grid size-11 place-items-center md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
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
            {user ? (
              <button
                onClick={handleSignOut}
                className="mt-4 rounded-sm border border-primary px-5 py-3 text-center text-sm font-semibold text-primary"
              >
                Sign out
              </button>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  onClick={() => setOpen(false)}
                  className="border-b border-border py-3"
                >
                  Sign in
                </Link>
                <Link
                  href="/upload"
                  className="mt-4 rounded-sm bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
                >
                  Start a book
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
