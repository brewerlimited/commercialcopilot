"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { trackAnalytics } from "@/lib/analyticsClient";

function classifyCta(text: string, href: string) {
  const lower = `${text} ${href}`.toLowerCase();
  if (lower.includes("demo")) return "demo_clicked";
  if (lower.includes("pricing")) return "pricing_clicked";
  if (lower.includes("trial") || lower.includes("create account") || lower.includes("/login")) return "trial_started";
  if (lower.includes("contact")) return "contact_clicked";
  return null;
}

function AnalyticsTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    trackAnalytics("page_viewed", {
      path: pathname,
      query: searchParams.toString().slice(0, 180),
      referrer: document.referrer || null,
      title: document.title || null,
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute("href") || "";
      const label = (link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90);
      const eventName = classifyCta(label, href);
      if (!eventName) return;

      trackAnalytics(eventName, {
        label,
        href,
        from_path: window.location.pathname,
      });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}

export default function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTrackerInner />
    </Suspense>
  );
}
