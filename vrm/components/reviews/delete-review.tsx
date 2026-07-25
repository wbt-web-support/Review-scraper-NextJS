"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteReview, type DeleteReviewState } from "@vrm/lib/reviews/delete";

/**
 * Delete one review, and its video. Irreversible.
 *
 * Rendered on both the tenant's dashboard and the agency's tenant page, from the
 * same card. Only the confirmation is here; the server re-derives who may delete
 * what and does not trust this form (see deleteReview).
 *
 * A dialog rather than a bare button, because unlike Approve and Reject this cannot
 * be walked back: Reject hides a review and keeps it, Delete destroys the customer's
 * recording. One click is too cheap for that. It stops short of DeleteTenant's
 * type-the-name gate though -- that guards an entire business and every review it
 * has ever collected, and putting the same friction on a single review would just
 * train people to ignore it.
 *
 * Native <dialog>, so focus trapping, Escape, and the backdrop are the browser's
 * job rather than ours to get subtly wrong.
 */
export function DeleteReview({
  reviewId,
  tenantId,
  reviewerName,
  hasVideo,
}: {
  reviewId: string;
  tenantId: string;
  reviewerName: string;
  hasVideo: boolean;
}) {
  const [state, action, pending] = useActionState<DeleteReviewState, FormData>(
    deleteReview,
    undefined,
  );

  const dialogRef = useRef<HTMLDialogElement>(null);

  // Reopen if the server refused, so the error lands where they are looking. On
  // success the row is gone and the card unmounts, so there is nothing to close.
  useEffect(() => {
    if (state && "error" in state) dialogRef.current?.showModal();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-field px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-red-50 hover:text-red-800"
      >
        Delete
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(26rem,calc(100vw-2rem))] rounded-card border border-muted bg-surface p-0 shadow-soft backdrop:bg-ink/50"
      >
        <form action={action} className="p-6">
          <input type="hidden" name="reviewId" value={reviewId} />
          {/* A hint, not a grant: honoured only for a verified super admin, and
              ignored outright for a tenant admin. See resolveWritableTenantId. */}
          <input type="hidden" name="tenantId" value={tenantId} />

          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Delete {reviewerName}&apos;s review?
          </h2>

          <p className="mt-3 rounded-field bg-red-50 px-3.5 py-3 text-sm text-red-800">
            {hasVideo
              ? "This deletes the review and permanently removes the video from storage. It cannot be undone."
              : "This permanently deletes the review. It cannot be undone."}
          </p>

          <p className="mt-3 text-sm text-ink-muted">
            To take it off the website without destroying it, reject it instead.
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
            <button
              type="submit"
              disabled={pending}
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
