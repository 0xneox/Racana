"use client";

import { useEffect, useRef, useState } from "react";

// Each entry is "Racana" written in a different Indic script. The Latin
// "RACANA" is always first and last so the animation settles back to the
// brand's primary identity. ~8 scripts keeps the cycle intentional rather
// than gimmicky, matching the editorial/luxury aesthetic.
const SCRIPTS = [
  { text: "RACANA", lang: "Latin", className: "" },
  { text: "रचना", lang: "Devanagari", className: "brand-lang-devanagari" },
  { text: "രചന", lang: "Malayalam", className: "brand-lang-malayalam" },
  { text: "ರಚನೆ", lang: "Kannada", className: "brand-lang-kannada" },
  { text: "రచన", lang: "Telugu", className: "brand-lang-telugu" },
  { text: "রচনা", lang: "Bengali", className: "brand-lang-bengali" },
  { text: "રચના", lang: "Gujarati", className: "brand-lang-gujarati" },
  { text: "ਰਚਨਾ", lang: "Gurmukhi", className: "brand-lang-gurmukhi" },
  { text: "ரசனா", lang: "Tamil", className: "brand-lang-tamil" },
  { text: "RACANA", lang: "Latin", className: "" },
] as const;

const INTERVAL_MS = 2800;

export function AnimatedBrand() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Respect the user's reduced-motion preference — if set, we leave
    // "RACANA" static and never start the cycle.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % SCRIPTS.length);
    }, INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reducedMotion]);

  const current = SCRIPTS[index];

  return (
    <div
      className="brand-word"
      role="img"
      aria-label="Racana"
    >
      {/* The animated script. Keyed by index so React remounts the span
          on each change, re-triggering the CSS entrance animation. */}
      <span
        key={index}
        aria-hidden="true"
        className={`brand-language ${current.className}`}
      >
        {current.text}
      </span>
    </div>
  );
}
