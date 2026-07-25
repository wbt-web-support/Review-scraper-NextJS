/**
 * Where the "Leave a review" button sends people.
 *
 * Prefers the tenant's own verified domain, so the visitor stays somewhere they
 * recognise: review.njdesignpark.com/c/acme rather than our host. Falls back to
 * this app's origin when there is no verified domain -- it works, but it drops the
 * visitor onto a domain they have never seen, mid-journey, which is exactly the
 * moment people abandon. That's why the admin UI nudges toward a custom domain
 * whenever 'page' mode is chosen.
 *
 * Isomorphic: w.js gets this URL pre-computed in its payload, and the settings UI
 * previews it.
 */
export function collectUrl({
  origin,
  slug,
  customDomain,
  customDomainVerified,
}: {
  origin: string;
  slug: string;
  customDomain: string | null;
  customDomainVerified: boolean;
}): string {
  const base =
    customDomain && customDomainVerified ? `https://${customDomain}` : origin;
  return `${base}/c/${slug}`;
}
