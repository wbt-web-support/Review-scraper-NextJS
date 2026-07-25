"use client";

import { useActionState, useState } from "react";
import {
  updateCollectionSettings,
  updateBranding,
  type ActionState,
} from "@vrm/lib/reviews/actions";
import { Button } from "@vrm/components/ui/button";
import { Input } from "@vrm/components/ui/input";

/**
 * Shared by /dashboard/settings (tenant editing themselves) and
 * /admin/tenants/[id] (super admin editing a tenant).
 *
 * `tenantId` is rendered as a hidden field. It is only honoured for super admins --
 * resolveWritableTenantId ignores it for a tenant_admin, who always gets their own
 * tenant. So a tenant admin editing the hidden field in devtools achieves nothing.
 */
export function Feedback({ state }: { state: ActionState }) {
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

export function BrandingForm({
  tenantId,
  name,
  brandColor,
  logoUrl,
  contactEmail,
  contactPhone,
}: {
  tenantId: string;
  name: string;
  brandColor: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateBranding,
    undefined,
  );
  const [color, setColor] = useState(brandColor);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="tenantId" value={tenantId} />

      <Input id="name" name="name" label="Business name" defaultValue={name} required />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          label="Business email"
          defaultValue={contactEmail ?? ""}
        />
        <Input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          label="Phone number"
          defaultValue={contactPhone ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="brandColor" className="block text-sm font-medium text-ink">
          Brand colour
        </label>
        <div className="flex items-center gap-3">
          <input
            id="brandColor"
            name="brandColor"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-field border border-muted bg-surface p-1"
          />
          <span className="font-mono text-sm text-ink-muted">{color.toUpperCase()}</span>
        </div>
      </div>

      <Input
        id="logoUrl"
        name="logoUrl"
        type="url"
        label="Logo URL"
        placeholder="https://example.com/logo.png"
        defaultValue={logoUrl ?? ""}
      />

      <Feedback state={state} />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save branding"}
      </Button>
    </form>
  );
}

export function CollectionForm({
  tenantId,
  welcomeText,
  thankYouText,
  promptQuestions,
}: {
  tenantId: string;
  welcomeText: string;
  thankYouText: string;
  promptQuestions: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateCollectionSettings,
    undefined,
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="tenantId" value={tenantId} />

      <Input
        id="welcomeText"
        name="welcomeText"
        label="Welcome message"
        defaultValue={welcomeText}
        required
      />

      <div className="space-y-1.5">
        <label htmlFor="promptQuestions" className="block text-sm font-medium text-ink">
          Prompt questions
        </label>
        <textarea
          id="promptQuestions"
          name="promptQuestions"
          rows={5}
          defaultValue={promptQuestions.join("\n")}
          placeholder="One question per line"
          className="block w-full rounded-field border border-muted bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-sage focus:outline-2 focus:outline-offset-0 focus:outline-sage/30"
        />
        <p className="text-xs text-ink-muted">
          One per line, up to 10. Shown to the customer before they record.
        </p>
      </div>

      <Input
        id="thankYouText"
        name="thankYouText"
        label="Thank you message"
        defaultValue={thankYouText}
        required
      />

      <Feedback state={state} />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save collection page"}
      </Button>
    </form>
  );
}
