"use client";

import { useActionState, useState } from "react";
import { setReviewOpenMode, type OpenModeState } from "@vrm/lib/tenants/open-mode";
import { Button } from "@vrm/components/ui/button";

type Mode = "dialog" | "page";

const MODES: { key: Mode; label: string; hint: string }[] = [
  {
    key: "dialog",
    label: "Open in a dialog",
    hint: "The visitor stays on the client's website. Best for conversion.",
  },
  {
    key: "page",
    label: "Open in a new tab",
    hint: "A full page, on the client's own domain if one is connected.",
  },
];

/**
 * AGENCY-ONLY. Never rendered on the tenant's own settings page.
 *
 * That's not just a UI decision: review_open_mode is not in the `authenticated`
 * column grants, so even if a tenant reached this form, Postgres would refuse the
 * write. setReviewOpenMode also calls assertRole('super_admin').
 */
export function OpenModeForm({
  tenantId,
  mode,
  collectUrl,
  hasCustomDomain,
}: {
  tenantId: string;
  mode: Mode;
  collectUrl: string;
  hasCustomDomain: boolean;
}) {
  const [state, action, pending] = useActionState<OpenModeState, FormData>(
    setReviewOpenMode,
    undefined,
  );
  const [selected, setSelected] = useState<Mode>(mode);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="grid gap-2 sm:grid-cols-2">
        {MODES.map((option) => {
          const active = selected === option.key;
          return (
            <label
              key={option.key}
              className={`cursor-pointer rounded-field border p-3.5 transition-colors ${
                active
                  ? "border-sage bg-sage-soft"
                  : "border-muted bg-surface hover:bg-sage-soft/50"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={option.key}
                checked={active}
                onChange={() => setSelected(option.key)}
                className="sr-only"
              />
              <span className="block text-sm font-medium text-ink">{option.label}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{option.hint}</span>
            </label>
          );
        })}
      </div>

      {selected === "page" && (
        <div className="rounded-field border border-muted bg-base px-3.5 py-3">
          <p className="text-xs text-ink-muted">The button will open</p>
          <p className="mt-0.5 break-all font-mono text-sm text-ink">{collectUrl}</p>

          {!hasCustomDomain && (
            <p className="mt-2.5 text-xs text-amber-800">
              This sends visitors to our domain, which they won&apos;t recognise
              mid-journey. Connect a custom domain to host it on the client&apos;s own
              domain instead.
            </p>
          )}
        </div>
      )}

      {state && "error" in state && (
        <p role="alert" className="rounded-field bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p role="status" className="rounded-field bg-sage-soft px-3.5 py-2.5 text-sm text-ink">
          {state.success}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
