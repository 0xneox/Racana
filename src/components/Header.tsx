"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, User, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
  const pathname = usePathname();
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
    <header className="border-b border-[#E8E2D5] bg-[#FDFBF7]/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-[#2D241E] flex items-center justify-center text-[#F8F5EE] shadow-sm group-hover:bg-[#45241C] transition-colors">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-lg font-bold tracking-tight text-[#1C1917] block leading-none">
              Manuscript In, Book Out
            </span>
            <span className="text-[11px] font-sans text-[#78716C] tracking-wide uppercase">
              Zero-Technical Interior Typesetting
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors hover:text-[#1C1917] ${
              pathname === "/" ? "text-[#1C1917] font-semibold" : "text-[#78716C]"
            }`}
          >
            Overview
          </Link>
          <Link
            href="/upload"
            className={`text-sm font-medium transition-colors hover:text-[#1C1917] ${
              pathname.startsWith("/upload") ? "text-[#1C1917] font-semibold" : "text-[#78716C]"
            }`}
          >
            New Book
          </Link>

          {user ? (
            <div className="flex items-center gap-3 pl-3 border-l border-[#E2DDD2]">
              <span className="text-xs text-[#57534E] flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5" />
                {user.name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs text-[#78716C] hover:text-[#A34825] transition-colors flex items-center gap-1"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth/signin"
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-[#D6CEBE] bg-[#F8F5EE] text-[#44403C] hover:border-[#1C1917] hover:text-[#1C1917] transition-all"
            >
              Author Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
