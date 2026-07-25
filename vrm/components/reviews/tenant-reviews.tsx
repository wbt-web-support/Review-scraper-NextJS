import Link from "next/link";
import { ReviewCard } from "./review-card";
import type { Review, ReviewCounts, ReviewStatus } from "@vrm/lib/reviews/queries";

const FILTERS: { key: ReviewStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

/**
 * One tenant's reviews, on the agency's tenant page.
 *
 * The same ReviewCard the tenant sees on their own dashboard, moderation buttons
 * included, so approving from here and approving from there are the same act
 * against the same row. A second read-only viewer would only invite the question
 * "why can't I approve it from here", and the answer would be "no reason".
 *
 * Filters are links carrying ?tab=reviews, so they survive a reload, are
 * shareable, and do not knock the surrounding settings tabs off Reviews.
 */
export function TenantReviews({
  reviews,
  counts,
  status,
  basePath,
  libraryId,
}: {
  reviews: Review[];
  counts: ReviewCounts;
  status: ReviewStatus | "all";
  basePath: string;
  libraryId: string | null;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-muted">
        {FILTERS.map((filter) => {
          const active = filter.key === status;
          return (
            <Link
              key={filter.key}
              href={`${basePath}?tab=reviews&status=${filter.key}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-sage text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {filter.label}
              <span className="ml-2 tabular-nums text-ink-muted">{counts[filter.key]}</span>
            </Link>
          );
        })}
      </div>

      {reviews.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-muted p-12 text-center">
          <p className="text-sm text-ink-muted">
            {counts.all === 0
              ? "This business has not collected any reviews yet."
              : "No reviews match this filter."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} libraryId={libraryId} />
          ))}
        </div>
      )}
    </div>
  );
}
