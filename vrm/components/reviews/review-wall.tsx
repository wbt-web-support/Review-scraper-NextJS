import type { WidgetPayload } from "@vrm/lib/widget/queries";
import { Stars } from "@vrm/components/reviews/stars";
import { VideoPlayer } from "@vrm/components/reviews/video-player";

/**
 * Public wall of a tenant's approved reviews.
 *
 * Shared by /s/[subdomain] (acme.ourdomain.com) and /d/[host]
 * (review.theirdomain.com). Both render the same thing; only how we resolved the
 * tenant differs.
 */
export function ReviewWall({ data }: { data: WidgetPayload }) {
  const { tenant, reviews, libraryId } = data;

  const average =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <main className="min-h-dvh bg-base px-5 py-14">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col items-center text-center">
          {tenant.logoUrl ? (
            // Plain <img>: the logo is an arbitrary per-tenant URL, so next/image
            // would need every client's host in remotePatterns up front.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-14 w-auto object-contain"
            />
          ) : (
            <div
              className="flex size-14 items-center justify-center rounded-full text-xl font-semibold text-white"
              style={{ backgroundColor: tenant.brandColor }}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            What customers say about {tenant.name}
          </h1>

          {average && (
            <div className="mt-4 flex items-center gap-3">
              <Stars rating={Math.round(Number(average))} color={tenant.brandColor} />
              <span className="text-sm text-ink-muted">
                {average} out of 5 · {reviews.length}{" "}
                {reviews.length === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}

          <a
            href={`/c/${tenant.slug}`}
            className="mt-6 inline-flex items-center gap-2 rounded-field px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: tenant.brandColor }}
          >
            Leave a review
          </a>
        </header>

        {reviews.length === 0 ? (
          <div className="mt-14 rounded-card border border-dashed border-muted bg-surface p-14 text-center">
            <p className="text-sm text-ink-muted">No reviews published yet.</p>
          </div>
        ) : (
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="flex flex-col gap-4 rounded-card border border-muted bg-surface p-5 shadow-soft"
              >
                {review.type === "video" && review.video_guid && (
                  <VideoPlayer
                    videoGuid={review.video_guid}
                    videoUrl={review.video_url}
                    thumbnailUrl={review.thumbnail_url}
                    libraryId={libraryId}
                  />
                )}

                {review.text_review && (
                  <p className="text-sm leading-relaxed text-ink">{review.text_review}</p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                  <div>
                    <p className="text-sm font-medium text-ink">{review.reviewer_name}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(review.created_at).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Stars rating={review.rating} color={tenant.brandColor} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
