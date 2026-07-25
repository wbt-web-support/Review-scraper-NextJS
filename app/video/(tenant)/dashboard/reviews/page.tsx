import { redirect } from "next/navigation";

/**
 * The review queue now lives on /dashboard itself, with the stats and filters.
 *
 * Kept as a redirect rather than deleted: this URL was linked from the dashboard
 * and may be bookmarked. Filters carry across so an old link still lands where it
 * meant to.
 */
export default async function ReviewsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; rating?: string }>;
}) {
  const { status, rating } = await searchParams;

  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  if (rating) sp.set("rating", rating);

  redirect(sp.size > 0 ? `/video/dashboard?${sp}` : "/video/dashboard");
}
