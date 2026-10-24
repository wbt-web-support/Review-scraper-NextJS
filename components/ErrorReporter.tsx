"use client";

import { useEffect } from "react";

/**
 * Sends uncaught browser errors to the built-in error tracker (/api/errors), so
 * they show up on the dashboard. Mounted once, in the app's root.
 *
 * Quiet by design: at most 10 reports per page load, each distinct error once,
 * and nothing from browser extensions or other sites' scripts.
 */
export default function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    let sent = 0;
    const send = (message: string, stack?: string) => {
      const key = `${message}|${(stack ?? "").slice(0, 200)}`;
      if (sent >= 10 || seen.has(key)) return;
      seen.add(key);
      sent++;
      const body = JSON.stringify({ message, stack, url: window.location.pathname, userAgent: navigator.userAgent });
      try {
        const queued = navigator.sendBeacon?.("/api/errors", new Blob([body], { type: "application/json" }));
        if (!queued) void fetch("/api/errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
      } catch {
        // never let reporting cause an error of its own
      }
    };
    const fromElsewhere = (stack?: string, file?: string) =>
      /chrome-extension:|moz-extension:|safari-extension:/.test(`${stack ?? ""} ${file ?? ""}`) ||
      (!!file && !file.startsWith(window.location.origin));
    const onError = (e: ErrorEvent) => {
      if (!e.message || e.message === "Script error." || /ResizeObserver loop/.test(e.message)) return;
      if (fromElsewhere(e.error?.stack, e.filename)) return;
      send(e.message, e.error?.stack);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const message = r instanceof Error ? r.message : typeof r === "string" ? r : "Unhandled promise rejection";
      if (fromElsewhere(r?.stack)) return;
      send(message, r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
