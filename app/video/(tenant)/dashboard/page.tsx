import Link from "next/link";
import { listReviews, reviewCounts, type ReviewStatus } from "@vrm/lib/reviews/queries";
import { getBunnyConfig } from "@vrm/lib/bunny/client";
import { ReviewCard } from "@vrm/components/reviews/review-card";

export const metadata = { title: "Dashboard" };

const TABS: { key: ReviewStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default async function DashboardPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise.
  searchParams: Promise<{ status?: string; rating?: string }>;
}) {
  const params = await searchParams;

  // Default to Pending: it's the only tab with work in it.
  const status = TABS.some((t) => t.key === params.status)
    ? (params.status as ReviewStatus | "all")
    : "pending";

  const ratingParam = params.rating ? Number(params.rating) : undefined;
  const rating = ratingParam && ratingParam >= 1 && ratingParam <= 5 ? ratingParam : undefined;

  // Both call getTenantContext internally -- that's the auth gate, and it also
  // scopes an impersonating super admin to the tenant they're viewing.
  const [reviews, counts] = await Promise.all([
    listReviews({ status: status === "all" ? undefined : status, rating }),
    reviewCounts(),
  ]);

  const libraryId = getBunnyConfig()?.libraryId ?? null;

  function href(next: { status?: string; rating?: string }) {
    const sp = new URLSearchParams();
    const s = next.status ?? status;
    if (s) sp.set("status", s);
    const r = next.rating ?? (rating ? String(rating) : "");
    if (r) sp.set("rating", r);
    return `/video/dashboard?${sp.toString()}`;
  }

  const stats = [
    { label: "Total", value: counts.all },
    { label: "Pending", value: counts.pending },
    { label: "Approved", value: counts.approved },
    { label: "Rejected", value: counts.rejected },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Reviews</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Nothing appears publicly until you approve it.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-card border border-muted bg-surface p-5 shadow-soft"
          >
            <dt className="text-sm text-ink-muted">{s.label}</dt>
            <dd className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-ink">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Status tabs. Plain links, so a filter is shareable and survives a reload. */}
      <div className="mt-10 flex flex-wrap gap-1 border-b border-muted">
        {TABS.map((tab) => {
          const active = tab.key === status;
          return (
            <Link
              key={tab.key}
              href={href({ status: tab.key })}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-sage text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
              <span className="ml-2 tabular-nums text-ink-muted">{counts[tab.key]}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">Rating</span>
        <Link
          href={href({ rating: "" })}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            !rating
              ? "bg-sage text-white"
              : "border border-muted text-ink-muted hover:bg-sage-soft"
          }`}
        >
          Any
        </Link>
        {[5, 4, 3, 2, 1].map((r) => (
          <Link
            key={r}
            href={href({ rating: String(r) })}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              rating === r
                ? "bg-sage text-white"
                : "border border-muted text-ink-muted hover:bg-sage-soft"
            }`}
          >
            {r} ★
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-muted bg-surface p-12 text-center">
          <p className="text-sm text-ink-muted">
            {counts.all === 0
              ? "No reviews yet. Share your collection link to get the first one."
              : status === "pending"
                ? "Nothing waiting for you. Nice."
                : "No reviews match this filter."}
          </p>
          {counts.all === 0 && (
            <Link
              href="/video/dashboard/settings"
              className="mt-4 inline-block text-sm font-medium text-sage transition-colors hover:text-sage-hover"
            >
              Get your collection link →
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} libraryId={libraryId} />
          ))}
        </div>
      )}
    </div>
  );
}
