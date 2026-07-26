/**
 * Custom domains.
 *
 * A tenant owns njdesignpark.com and wants their reviews at
 * reviews.njdesignpark.com. We fix the "reviews" label; they supply the root domain
 * and point DNS at us.
 *
 * Isomorphic (no server-only import): the settings form previews the hostname as
 * the tenant types, and the server validates it. Same rules, one place.
 */

/** The label we prepend. Fixed by us, not configurable per tenant. */
export const REVIEW_SUBDOMAIN = "reviews";

/**
 * Where tenants point their CNAME.
 *
 * On Vercel this is `cname.vercel-dns.com`. Self-hosted, it's your load
 * balancer's hostname. Falls back to the app's own root domain, which is right for
 * a simple single-host deploy.
 */
export function cnameTarget(): string {
  return (
    process.env.NEXT_PUBLIC_CNAME_TARGET ||
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
    "your-app-host.example.com"
  );
}

/** "https://NJDesignPark.com/" or "www.njdesignpark.com" -> "njdesignpark.com" */
export function normalizeRootDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0];
  value = value.split(":")[0];
  value = value.replace(/^www\./, "");
  // If they pasted the full review host, strip our own label back off.
  value = value.replace(new RegExp(`^${REVIEW_SUBDOMAIN}\\.`), "");
  value = value.replace(/\.$/, "");

  if (!isValidDomain(value)) return null;
  return value;
}

export function isValidDomain(value: string): boolean {
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(value);
}

/** "njdesignpark.com" -> "reviews.njdesignpark.com" */
export function reviewHostFor(rootDomain: string): string {
  return `${REVIEW_SUBDOMAIN}.${rootDomain}`;
}

/** "reviews.njdesignpark.com" -> "njdesignpark.com" */
export function rootDomainFor(reviewHost: string): string {
  return reviewHost.replace(new RegExp(`^${REVIEW_SUBDOMAIN}\\.`), "");
}
