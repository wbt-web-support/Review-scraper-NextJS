"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteTenant, type DeleteState } from "@vrm/lib/tenants/delete";
import { Button } from "@vrm/components/ui/button";

/**
 * Delete a tenant. AGENCY-ONLY, irreversible.
 *
 * The confirmation asks the admin to TYPE the business name, not just click "yes".
 * A yes/no dialog is muscle memory after the third time; typing "Acme Renewables"
 * is not something you do by accident. The server re-checks the typed name too --
 * this is a real guard, not a UI flourish.
 *
 * Native <dialog>, so focus trapping, Escape, and the backdrop are the browser's
 * job rather than ours to get subtly wrong.
 */
export function DeleteTenant({
  tenantId,
  tenantName,
  reviewCount,
}: {
  tenantId: string;
  tenantName: string;
  reviewCount: number;
}) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    deleteTenant,
    undefined,
  );

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");

  const matches = typed.trim() === tenantName.trim();

  // Reopen if the server rejected the attempt, so the error is where they're looking.
  useEffect(() => {
    if (state && "error" in state) dialogRef.current?.showModal();
  }, [state]);

  function open() {
    setTyped("");
    dialogRef.current?.showModal();
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={open}
        className="border border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        Delete this business
      </Button>

      <dialog
        ref={dialogRef}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-card border border-muted bg-surface p-0 shadow-soft backdrop:bg-ink/50"
        onClose={() => setTyped("")}
      >
        <form action={action} className="p-6">
          <input type="hidden" name="tenantId" value={tenantId} />

          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Delete {tenantName}?
          </h2>

          <div className="mt-3 rounded-field bg-red-50 px-3.5 py-3 text-sm text-red-800">
            <p className="font-medium">This cannot be undone.</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              <li>
                {reviewCount} {reviewCount === 1 ? "review" : "reviews"} and any
                recorded videos
              </li>
              <li>Their login, collection page, and embed key</li>
              <li>Any widget already embedded on their website will stop working</li>
            </ul>
          </div>

          <label
            htmlFor="confirmName"
            className="mt-5 block text-sm text-ink"
          >
            Type <span className="font-mono font-medium">{tenantName}</span> to
            confirm.
          </label>
          <input
            id="confirmName"
            name="confirmName"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="mt-1.5 block w-full rounded-field border border-muted bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-red-400 focus:outline-2 focus:outline-offset-0 focus:outline-red-200"
          />

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
            <button
              type="submit"
              disabled={!matches || pending}
              className="rounded-field bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
