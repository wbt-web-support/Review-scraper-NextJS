"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTenantAction, type FormState } from "@vrm/lib/tenants/actions";
import { slugify } from "@vrm/lib/tenants/slug";
import { normalizeRootDomain, reviewHostFor } from "@vrm/lib/domains/domain";
import { suggestPassword } from "@vrm/lib/tenants/password";
import { Button } from "@vrm/components/ui/button";

const FIELD =
  "block w-full rounded-field border border-muted bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-sage focus:outline-2 focus:outline-offset-0 focus:outline-sage/30";
const LABEL = "block text-xs font-medium text-ink-muted";

/**
 * Create a tenant, in a dialog.
 *
 * A whole page for one short form was a needless navigation away from the list --
 * you create a tenant, you want to be back on the list. Native <dialog>, so focus
 * trapping, Escape, and the backdrop are the browser's problem, not ours.
 *
 * The action redirects to the new tenant's page on success, so there is no
 * "success" state to handle here -- only errors, which reopen the dialog.
 */
export function NewTenantDialog() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createTenantAction,
    undefined,
  );

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [brandColor, setBrandColor] = useState("#8A9A5B");
  const [password, setPassword] = useState(suggestPassword);
  const [domain, setDomain] = useState("");

  // Reopen on a server error, so the message is where they're looking.
  useEffect(() => {
    if (state && "error" in state) dialogRef.current?.showModal();
  }, [state]);

  // Preview only. The server generates the real slug and de-duplicates it, so this
  // can differ (e.g. "acme-2") if the name is taken.
  const slug = slugify(name);

  const root = normalizeRootDomain(domain);
  const reviewHost = root ? reviewHostFor(root) : null;

  function open() {
    setName("");
    setEmail("");
    setBrandColor("#8A9A5B");
    setPassword(suggestPassword());
    setDomain("");
    dialogRef.current?.showModal();
  }

  return (
    <>
      <Button type="button" onClick={open}>
        New tenant
      </Button>

      <dialog
        ref={dialogRef}
        className="w-[min(40rem,calc(100vw-2rem))] rounded-card border border-muted bg-surface p-0 shadow-soft backdrop:bg-ink/50"
      >
        <form action={action} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight text-ink">New tenant</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Creates the collection page, embed key, subdomain, and the owner&apos;s
            login.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <label htmlFor="name" className={LABEL}>
                Business name
              </label>
              <input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Renewables"
                required
                autoFocus
                className={FIELD}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="contactEmail" className={LABEL}>
                Business email (this is their login)
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@acme.co.uk"
                autoComplete="off"
                required
                className={FIELD}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contactPhone" className={LABEL}>
                Phone
              </label>
              <input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                placeholder="07700 900123"
                autoComplete="off"
                className={FIELD}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="adminPassword" className={LABEL}>
                Temporary password
              </label>
              <div className="flex gap-2">
                {/* type=text on purpose: you're going to read this out to the client,
                    so hiding it behind dots helps nobody. */}
                <input
                  id="adminPassword"
                  name="adminPassword"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  required
                  minLength={8}
                  className={`${FIELD} font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setPassword(suggestPassword())}
                  className="shrink-0 rounded-field border border-muted px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
                >
                  New
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="brandColor" className={LABEL}>
                Brand colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="brandColor"
                  name="brandColor"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-field border border-muted bg-surface p-1"
                />
                <span className="font-mono text-xs text-ink-muted">
                  {brandColor.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="rootDomain" className={LABEL}>
                Their website (optional)
              </label>
              <input
                id="rootDomain"
                name="rootDomain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="njdesignpark.com"
                autoComplete="off"
                spellCheck={false}
                className={FIELD}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="logoUrl" className={LABEL}>
                Logo URL (optional)
              </label>
              <input
                id="logoUrl"
                name="logoUrl"
                type="url"
                placeholder="https://…/logo.png"
                className={FIELD}
              />
            </div>
          </div>

          {reviewHost && (
            <p className="mt-3 rounded-field border border-muted bg-base px-3.5 py-2.5 text-xs text-ink-muted">
              Their reviews will live at{" "}
              <span className="font-mono text-ink">{reviewHost}</span> once they add
              the DNS record. We&apos;ll show them how on their page — nothing serves
              on that domain until it&apos;s verified.
            </p>
          )}

          <p className="mt-4 text-xs text-ink-muted">
            Collection page{" "}
            <span className="font-mono text-ink">/c/{slug || "…"}</span> · subdomain{" "}
            <span className="font-mono text-ink">{slug || "…"}</span> · embed key
            generated on save
          </p>

          {state && "error" in state && (
            <p
              role="alert"
              className="mt-4 rounded-field bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
            >
              {state.error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-field px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
            >
              Cancel
            </button>
            <Button type="submit" disabled={pending || !slug}>
              {pending ? "Creating…" : "Create tenant"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
