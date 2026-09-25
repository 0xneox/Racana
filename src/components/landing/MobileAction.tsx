"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function MobileAction() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = document.querySelector("#hero-action");
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setVisible(!entry.isIntersecting);
      },
      { threshold: 0.2 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return (
    <Link
      href="/upload"
      aria-hidden={!visible}
      className={`fixed inset-x-4 bottom-4 z-40 flex min-h-14 items-center justify-between rounded-sm bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lift transition-all duration-300 md:hidden ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-20 opacity-0"
      }`}
    >
      <span>Start with your manuscript</span>
      <ArrowRight className="size-4" />
    </Link>
  );
}
