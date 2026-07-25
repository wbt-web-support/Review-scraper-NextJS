/**
 * Turns a business name into a DNS-safe label.
 *
 * The result becomes both the collection URL (/c/<slug>) and a subdomain, so it
 * must satisfy the tenants_slug_format CHECK in the database: lowercase
 * alphanumerics and inner hyphens, 1-63 chars, no leading/trailing hyphen.
 */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD") // split accented chars so the diacritics can be dropped
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, ""); // slice(63) can leave a trailing hyphen

  return base;
}

/** Reserved because they collide with our own routes or with common infra hosts. */
export const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "dashboard",
  "login",
  "logout",
  "c",
  "w",
  "widget",
  "embed",
  "static",
  "assets",
  "mail",
  "ftp",
  "cdn",
  "status",
  "support",
  "help",
  "docs",
  "blog",
]);

export function isValidSlug(slug: string): boolean {
  return (
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug)
  );
}
