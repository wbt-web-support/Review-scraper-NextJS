"use client";

import { useActionState, useState } from "react";
import { setMaxVideoSeconds, type VideoLimitState } from "@vrm/lib/tenants/video-limit";
import { VIDEO_LENGTH_OPTIONS, formatVideoLength } from "@vrm/lib/video/limits";
import { Button } from "@vrm/components/ui/button";

/**
 * AGENCY-ONLY. Never rendered on the tenant's own settings page.
 *
 * That's not just a UI decision: max_video_seconds is absent from the
 * `authenticated` column grants, so even if a tenant reached this form, Postgres
 * would refuse the write. setMaxVideoSeconds also calls assertRole('super_admin').
 */
export function VideoLimitForm({
  tenantId,
  maxVideoSeconds,
}: {
  tenantId: string;
  maxVideoSeconds: number;
}) {
  const [state, action, pending] = useActionState<VideoLimitState, FormData>(
    setMaxVideoSeconds,
    undefined,
  );
  const [selected, setSelected] = useState(maxVideoSeconds);

  // A tenant set up before this existed, or hand-edited in SQL, can hold a value
  // that isn't one of the presets. Show it rather than silently snapping them to
  // the nearest option the moment someone opens this tab.
  const options: number[] = VIDEO_LENGTH_OPTIONS.includes(
    maxVideoSeconds as (typeof VIDEO_LENGTH_OPTIONS)[number],
  )
    ? [...VIDEO_LENGTH_OPTIONS]
    : [...VIDEO_LENGTH_OPTIONS, maxVideoSeconds].sort((a, b) => a - b);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="space-y-1.5">
        <label htmlFor="maxVideoSeconds" className="block text-sm font-medium text-ink">
          Maximum video length
        </label>
        <select
          id="maxVideoSeconds"
          name="maxVideoSeconds"
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="block w-full max-w-xs rounded-field border border-muted bg-surface px-3.5 py-2.5 text-sm text-ink focus:outline-2 focus:outline-offset-0 focus:outline-sage"
        >
          {options.map((seconds) => (
            <option key={seconds} value={seconds}>
              {formatVideoLength(seconds)}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-muted">
          The recorder stops there, and a longer upload is refused. Reviews already
          collected keep their length.
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

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
