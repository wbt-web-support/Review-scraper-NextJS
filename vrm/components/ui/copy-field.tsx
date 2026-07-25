"use client";

import { useState } from "react";

export function CopyField({
  label,
  value,
  /** When set, the value is also a link that opens it. Use for URLs worth clicking. */
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is blocked on insecure origins and in some browsers. The value
      // is visible and selectable regardless, so there is nothing to recover from.
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-ink">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 overflow-x-auto whitespace-pre rounded-field border border-muted bg-base px-3.5 py-2.5 font-mono text-xs text-ink">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 transition-colors hover:text-sage hover:underline"
            >
              {value}
            </a>
          ) : (
            value
          )}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-field border border-muted px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
