"use client";

import { useActionState, useState } from "react";
import { rotateApiKey } from "@vrm/lib/tenants/api-key";
import type { ActionState } from "@vrm/lib/reviews/actions";
import { Button } from "@vrm/components/ui/button";
import { CopyField } from "@vrm/components/ui/copy-field";

/**
 * The client's integration API, on the agency's tenant page.
 *
 * The key is shown in full rather than masked. Masking would be security theatre
 * here: only a super admin can reach this page, and the one thing they came to do
 * is hand the key to the client's developer.
 */
export function ApiAccess({
  tenantId,
  apiKey,
  origin,
}: {
  tenantId: string;
  apiKey: string;
  origin: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    rotateApiKey,
    undefined,
  );
  const [confirming, setConfirming] = useState(false);

  const endpoint = `${origin}/api/v1/reviews`;

  return (
    <div className="space-y-6">
      <CopyField label="Endpoint" value={`GET ${endpoint}`} />
      <CopyField label="API key (secret)" value={apiKey} />

      <div className="rounded-field border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="text-xs leading-relaxed text-amber-900">
          This key returns pending and rejected reviews, and reviewer email
          addresses. It belongs on the client&apos;s server, never in their website&apos;s
          JavaScript, where every visitor would be handed a copy. For a public
          testimonial wall they want the embed widget instead, which exposes only
          approved reviews with no personal data.
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink">Example</span>
        <pre className="overflow-x-auto rounded-field border border-muted bg-base px-3.5 py-3 font-mono text-xs leading-relaxed text-ink">
{`curl -H "Authorization: Bearer ${apiKey}" \\
  "${endpoint}?status=approved&type=video&limit=50"`}
        </pre>
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink">Filters</span>
        <dl className="overflow-hidden rounded-field border border-muted text-xs">
          {[
            ["status", "approved (default), pending, rejected, or all"],
            ["type", "video or text. Omit for both."],
            ["limit", "1 to 100. Defaults to 50."],
            ["offset", "For paging. The response returns total."],
          ].map(([name, meaning]) => (
            <div
              key={name}
              className="flex gap-3 border-b border-muted px-3.5 py-2.5 last:border-b-0"
            >
              <dt className="w-16 shrink-0 font-mono text-ink">{name}</dt>
              <dd className="text-ink-muted">{meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="pt-1 text-xs leading-relaxed text-ink-muted">
          Each video carries a <code className="font-mono">play_url</code> to link
          or send, an <code className="font-mono">embed_url</code> for an iframe, a
          thumbnail, and <code className="font-mono">ready</code>, which is false
          while Bunny is still encoding. The raw{" "}
          <code className="font-mono">url</code> is an HLS playlist for a player to
          consume, not a link to open.
        </p>
      </div>

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

      <form action={action} className="border-t border-muted pt-5">
        <input type="hidden" name="tenantId" value={tenantId} />
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Generating…" : "Yes, break the old key"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-muted"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="border border-muted"
            onClick={() => setConfirming(true)}
          >
            Generate a new key
          </Button>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          The old key stops working the instant a new one is generated. Anything the
          client has already built against it breaks until they paste the new one in.
        </p>
      </form>
    </div>
  );
}
