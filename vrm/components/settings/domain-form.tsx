"use client";

import { useActionState, useState, useTransition } from "react";
import {
  saveCustomDomain,
  verifyCustomDomain,
  type DomainState,
} from "@vrm/lib/domains/actions";
import {
  normalizeRootDomain,
  reviewHostFor,
  rootDomainFor,
  REVIEW_SUBDOMAIN,
} from "@vrm/lib/domains/domain";
import type { DnsRecord } from "@vrm/lib/vercel/client";
import { Button } from "@vrm/components/ui/button";
import { Input } from "@vrm/components/ui/input";

function Feedback({ state }: { state: DomainState }) {
  if (!state) return null;
  if ("error" in state) {
    return (
      <p role="alert" className="rounded-field bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
        {state.error}
      </p>
    );
  }
  return (
    <p role="status" className="rounded-field bg-sage-soft px-3.5 py-2.5 text-sm text-ink">
      {state.success}
    </p>
  );
}

export function DomainForm({
  tenantId,
  customDomain,
  verified,
  records,
  serving,
}: {
  tenantId: string;
  customDomain: string | null;
  verified: boolean;
  /** Straight from the host, not hardcoded -- Vercel issues a per-project target. */
  records: DnsRecord[];
  /** The host confirms it is serving the domain. */
  serving: boolean;
}) {
  const [state, action, pending] = useActionState<DomainState, FormData>(
    saveCustomDomain,
    undefined,
  );

  const [verifyState, setVerifyState] = useState<DomainState>(undefined);
  const [verifying, startVerify] = useTransition();

  const [input, setInput] = useState(customDomain ? rootDomainFor(customDomain) : "");

  // Live preview of the host they'll get. The server re-derives it, so this is
  // presentation only.
  const previewRoot = normalizeRootDomain(input);
  const previewHost = previewRoot ? reviewHostFor(previewRoot) : null;

  // The record to add is for the saved domain, not the half-typed one.
  const savedHost = customDomain;

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="tenantId" value={tenantId} />
        <Input
          id="rootDomain"
          name="rootDomain"
          label="Your website's domain"
          placeholder="njdesignpark.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />

        <div className="rounded-field border border-muted bg-base px-3.5 py-3">
          <p className="text-xs text-ink-muted">Your reviews will live at</p>
          <p className="mt-0.5 font-mono text-sm font-medium text-ink">
            {previewHost ? (
              <>
                <span className="text-sage">{REVIEW_SUBDOMAIN}.</span>
                {previewRoot}
              </>
            ) : (
              <span className="text-ink-muted">{REVIEW_SUBDOMAIN}.yourdomain.com</span>
            )}
          </p>
        </div>

        <Feedback state={state} />

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : savedHost ? "Update domain" : "Connect domain"}
        </Button>
      </form>

      {savedHost && (
        <div className="rounded-card border border-muted bg-base p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={`size-2 rounded-full ${serving ? "bg-sage" : "bg-amber-500"}`}
              />
              <p className="font-mono text-sm font-medium text-ink">{savedHost}</p>
              {/* "Live" now means the HOST is serving it -- not just that DNS points
                  somewhere. Those are different questions, and only the second one
                  tells you the domain actually works. */}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  serving ? "bg-sage-soft text-ink" : "bg-amber-50 text-amber-800"
                }`}
              >
                {serving ? "Live" : verified ? "Finishing setup" : "Awaiting DNS"}
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="border border-muted"
              disabled={verifying}
              onClick={() =>
                startVerify(async () =>
                  setVerifyState(await verifyCustomDomain(tenantId)),
                )
              }
            >
              {verifying ? "Checking…" : serving ? "Re-check" : "Verify"}
            </Button>
          </div>

          {/* The records the HOST actually asked for. Shown until it confirms it is
              serving the domain -- not merely until our own DNS check passes, which
              was the bug that let this say "Live" while the domain reset every
              connection. */}
          {!serving && (
            <>
              <p className="mt-5 text-sm text-ink">
                Add {records.length === 1 ? "this record" : "these records"} at your DNS
                provider (GoDaddy, Cloudflare, Namecheap…), then press Verify.
              </p>

              <div className="mt-3 overflow-x-auto rounded-field border border-muted bg-surface">
                <table className="w-full min-w-[30rem] text-left text-sm">
                  <thead className="border-b border-muted text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Type</th>
                      <th className="px-3.5 py-2.5 font-medium">Name</th>
                      <th className="px-3.5 py-2.5 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={`${r.type}-${r.value}`} className="border-t border-muted/60 first:border-0">
                        <td className="px-3.5 py-2.5 font-mono text-ink">{r.type}</td>
                        <td className="px-3.5 py-2.5 font-mono text-ink">{r.name}</td>
                        <td className="px-3.5 py-2.5">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(r.value)}
                            title="Copy"
                            className="break-all text-left font-mono text-ink transition-colors hover:text-sage"
                          >
                            {r.value}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-ink-muted">
                Click a value to copy it. DNS changes usually apply within minutes, but
                can take up to an hour.
              </p>
            </>
          )}

          <div className="mt-4">
            <Feedback state={verifyState} />
          </div>
        </div>
      )}
    </div>
  );
}
