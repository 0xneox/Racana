"use client";

// Lightweight funnel tracking: our own /api/events table + Umami when it's
// configured. Never throws — analytics must not break the product.
export function track(event: string, props?: Record<string, unknown>, jobId?: string) {
  try {
    const w = window as any;
    if (typeof w.umami?.track === "function") {
      w.umami.track(event, props as any);
    }
  } catch {
    /* umami absent */
  }

  try {
    const payload = JSON.stringify({ event, props, jobId });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([payload], { type: "text/plain" })
      );
    } else {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* never break UX for analytics */
  }
}
