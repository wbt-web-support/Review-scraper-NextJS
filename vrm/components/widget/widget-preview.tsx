"use client";

import { useActionState, useState } from "react";
import { updateWidgetSettings, type ActionState } from "@vrm/lib/reviews/actions";
import { Button } from "@vrm/components/ui/button";
import { CopyField } from "@vrm/components/ui/copy-field";

type Layout = "grid" | "carousel" | "single";

const LAYOUTS: { key: Layout; label: string; hint: string }[] = [
  { key: "grid", label: "Grid", hint: "A wall of reviews" },
  { key: "carousel", label: "Carousel", hint: "One row, scrolls sideways" },
  { key: "single", label: "Single", hint: "One centred column" },
];

/**
 * Live preview of the embed widget.
 *
 * Runs the REAL public/w.js inside an iframe rather than re-implementing the
 * widget in React. A React copy would drift from the shipped bundle the first time
 * either changed, and the whole point of a preview is to show what the client will
 * actually see -- including the shadow-DOM isolation.
 *
 * srcDoc rather than a preview route: the iframe inherits this origin, so a
 * relative /w.js and the CORS-enabled /api/widget call both just work, and there is
 * no extra public URL to secure.
 */
export function WidgetPreview({
  tenantId,
  embedKey,
  origin,
  initialLayout,
  initialAutoplay,
  editable = true,
}: {
  tenantId: string;
  embedKey: string;
  origin: string;
  initialLayout: Layout;
  initialAutoplay: boolean;
  editable?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateWidgetSettings,
    undefined,
  );

  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  // data-layout overrides the saved setting, so the preview updates instantly
  // without a round-trip. Saving is a separate, explicit act.
  const srcDoc = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:20px; background:#fff;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
</style></head>
<body>
  <script src="${origin}/w.js" data-tenant="${embedKey}" data-layout="${layout}"></script>
</body></html>`;

  return (
    <div>
      {editable && (
        <form action={action} className="space-y-5">
          <input type="hidden" name="tenantId" value={tenantId} />
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-ink">Layout</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {LAYOUTS.map((option) => {
                const active = layout === option.key;
                return (
                  <label
                    key={option.key}
                    className={`cursor-pointer rounded-field border p-3 transition-colors ${
                      active
                        ? "border-sage bg-sage-soft"
                        : "border-muted bg-surface hover:bg-sage-soft/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="layout"
                      value={option.key}
                      checked={active}
                      onChange={() => setLayout(option.key)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-medium text-ink">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {option.hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              name="autoplay"
              defaultChecked={initialAutoplay}
              className="size-4 rounded border-muted accent-sage"
            />
            <span className="text-sm text-ink">Autoplay videos</span>
          </label>

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
            {pending ? "Saving…" : "Save widget layout"}
          </Button>
        </form>
      )}

      {/* The snippet carries data-layout, so it IS the embed code for THIS layout --
          switch the layout above and the code below changes with it.

          One line, because w.js mounts itself correctly wherever it is pasted: in a
          WordPress HTML block, inside a page-builder div, or even in <head> (where
          it falls back to the end of <body>, since a widget rendered inside <head>
          would be invisible). */}
      <div className="mt-8">
        <CopyField
          label={`Embed code — ${layout}`}
          value={`<script src="${origin}/w.js" data-tenant="${embedKey}" data-layout="${layout}" async></script>`}
        />
        <p className="mt-2 text-xs text-ink-muted">
          Paste this where you want the reviews to appear — a WordPress
          &ldquo;Custom HTML&rdquo; block, a page builder, or straight into your
          HTML. It renders in place.
        </p>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-ink-muted transition-colors hover:text-ink">
            Need it to render somewhere else on the page?
          </summary>
          <div className="mt-3">
            <CopyField
              label="Put the reviews in a specific spot"
              value={`<div id="reviews-widget"></div>\n<script src="${origin}/w.js" data-tenant="${embedKey}" data-layout="${layout}" data-target="reviews-widget" async></script>`}
            />
            <p className="mt-2 text-xs text-ink-muted">
              The reviews render inside the <code>div</code>. The script tag can then
              go anywhere, including your theme&apos;s header.
            </p>
          </div>
        </details>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Preview</p>
            <p className="text-xs text-ink-muted">
              Exactly what visitors see on your website.
            </p>
          </div>

          <div className="flex gap-1 rounded-field border border-muted bg-surface p-0.5">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className={`rounded-[7px] px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  device === d ? "bg-sage text-white" : "text-ink-muted hover:text-ink"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex justify-center overflow-hidden rounded-card border border-muted bg-base p-4">
          <iframe
            // Remount on any change: the widget reads its config once, at script
            // execution, so mutating the attributes in place would do nothing.
            key={`${layout}-${device}-${embedKey}`}
            srcDoc={srcDoc}
            title="Widget preview"
            sandbox="allow-scripts allow-popups allow-same-origin"
            className="rounded-field border border-muted bg-white transition-[width]"
            style={{
              width: device === "mobile" ? 390 : "100%",
              height: 460,
            }}
          />
        </div>
      </div>
    </div>
  );
}
