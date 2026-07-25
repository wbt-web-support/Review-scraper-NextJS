import { setReviewStatus } from "@vrm/lib/reviews/actions";
import { isDirectVideo } from "@vrm/lib/video/provider";
import { bunnyPlayUrl } from "@vrm/lib/bunny/urls";
import { CopyField } from "@vrm/components/ui/copy-field";
import { VideoPlayer } from "./video-player";
import { DeleteReview } from "./delete-review";
import { Stars } from "./stars";
import type { Review } from "@vrm/lib/reviews/queries";

const STATUS_STYLES: Record<Review["status"], string> = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-sage-soft text-ink",
  rejected: "bg-red-50 text-red-800",
};

function StatusButton({
  reviewId,
  tenantId,
  status,
  label,
  variant,
}: {
  reviewId: string;
  tenantId: string;
  status: Review["status"];
  label: string;
  variant: "approve" | "reject" | "neutral";
}) {
  const styles = {
    approve: "bg-sage text-white hover:bg-sage-hover",
    reject: "border border-muted text-ink-muted hover:bg-red-50 hover:text-red-800",
    neutral: "border border-muted text-ink-muted hover:bg-sage-soft hover:text-ink",
  }[variant];

  return (
    // A form + server action, not an onClick fetch: this is a mutation, and it
    // works without client JS.
    //
    // tenantId is a hint, not a grant. It is what lets the agency moderate from
    // /admin/tenants/[id] without impersonating; the server honours it only for a
    // verified super admin and ignores it outright for a tenant admin, who always
    // writes to their own tenant. See resolveWritableTenantId.
    <form action={setReviewStatus}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={`rounded-field px-3.5 py-2 text-sm font-medium transition-colors ${styles}`}
      >
        {label}
      </button>
    </form>
  );
}

/**
 * Where the video actually lives, and the link to open it.
 *
 * The player looks identical whichever provider served the row, so when a video
 * misbehaves the first two questions are always "which host" and "what URL". Both
 * answers belong on the card, not in a database query. Rows can also outlive the
 * config that produced them: a library seeded before Bunny was set up is still
 * sitting on Supabase Storage, and this is the only place that shows it.
 *
 * The Bunny link is DERIVED from the GUID, not read from reviews.video_url. Two
 * reasons, and both matter:
 *
 *   1. video_url holds the HLS playlist, which is a machine URL. Opened by a human
 *      it 403s, and Chrome and Firefox cannot play an .m3u8 unaided regardless. The
 *      play URL opens and plays anywhere.
 *   2. video_url is null until the encode webhook fires, so the card used to say
 *      "Not available yet" about a URL that was perfectly well known -- it is just
 *      the library ID and the GUID. Deriving it means there is always a link.
 */
function VideoSource({
  videoGuid,
  videoUrl,
  libraryId,
}: {
  videoGuid: string;
  videoUrl: string | null;
  libraryId: string | null;
}) {
  const direct = isDirectVideo(videoUrl);

  // Supabase keeps the file at a public URL. Bunny's is built from the GUID.
  const url = direct
    ? videoUrl
    : libraryId
      ? bunnyPlayUrl(libraryId, videoGuid)
      : null;

  return (
    <div className="mt-3 space-y-3 rounded-field border border-muted bg-base px-3.5 py-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-20 shrink-0 text-ink-muted">Stored on</span>
        <span className="font-medium text-ink">
          {direct ? "Supabase Storage" : "Bunny Stream"}
        </span>
      </div>

      {url ? (
        <CopyField label="Video URL" value={url} href={url} />
      ) : (
        // A Bunny row with no Bunny configured. There is no host to build a URL
        // against, so say that rather than show a link that goes nowhere.
        <p className="text-xs text-ink-muted">
          Add your Bunny credentials to get a link to this video.
        </p>
      )}
    </div>
  );
}

export function ReviewCard({
  review,
  libraryId,
}: {
  review: Review;
  libraryId: string | null;
}) {
  const date = new Date(review.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="rounded-card border border-muted bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-medium text-ink">{review.reviewer_name}</h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[review.status]}`}
            >
              {review.status}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <Stars rating={review.rating} />
            <span className="text-xs text-ink-muted">{date}</span>
          </div>
        </div>
      </div>

      {review.type === "video" && review.video_guid && (
        <div className="mt-4">
          <VideoPlayer
            videoGuid={review.video_guid}
            videoUrl={review.video_url}
            thumbnailUrl={review.thumbnail_url}
            libraryId={libraryId}
          />
          {!review.video_url && (
            // Only reachable on the Bunny path: the row is written before the bytes
            // arrive and video_url is filled in by the encode webhook. (On the
            // Supabase fallback the URL is known at insert time, so this never
            // shows.) A missing URL means encoding is still in flight, or the
            // upload was abandoned.
            <p className="mt-2 text-xs text-ink-muted">
              Still processing. It will play once encoding finishes.
            </p>
          )}
          <VideoSource
            videoGuid={review.video_guid}
            videoUrl={review.video_url}
            libraryId={libraryId}
          />
        </div>
      )}

      {review.text_review && (
        <blockquote className="mt-4 border-l-2 border-muted pl-4 text-sm leading-relaxed text-ink">
          {review.text_review}
        </blockquote>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {review.status !== "approved" && (
          <StatusButton
            reviewId={review.id}
            tenantId={review.tenant_id}
            status="approved"
            label="Approve"
            variant="approve"
          />
        )}
        {review.status !== "rejected" && (
          <StatusButton
            reviewId={review.id}
            tenantId={review.tenant_id}
            status="rejected"
            label="Reject"
            variant="reject"
          />
        )}
        {review.status !== "pending" && (
          <StatusButton
            reviewId={review.id}
            tenantId={review.tenant_id}
            status="pending"
            label="Move back to pending"
            variant="neutral"
          />
        )}

        {/* Pushed to the far end, away from Approve. Moderation is reversible and
            Delete is not, so they should not sit next to each other where a stray
            click lands on the wrong one. */}
        <div className="ml-auto">
          <DeleteReview
            reviewId={review.id}
            tenantId={review.tenant_id}
            reviewerName={review.reviewer_name}
            hasVideo={review.type === "video" && Boolean(review.video_guid)}
          />
        </div>
      </div>
    </article>
  );
}
