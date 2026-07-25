/**
 * Refuses to load in a browser bundle. Import for the side effect:
 *
 *   import "@vrm/lib/server-guard";
 *
 * This replaces `import "server-only"` in the modules that BOTH halves of this app
 * reach. That package's export map is:
 *
 *   { "react-server": "./empty.js", "default": "./index.js" }   <- index.js throws
 *
 * Only the App Router's server layer gets the `react-server` condition. A Pages
 * Router API route does not, so it resolves to the throwing entry and dies at
 * runtime -- even though an API route is as server-side as code gets. Since the
 * scraper's /api/widgets provisions Supabase tenants, it has to import this chain,
 * and `server-only` makes that impossible.
 *
 * What is lost: `server-only` fails at BUILD time when a client component imports
 * it; this fails at runtime instead. What is not lost is the thing that actually
 * matters -- SUPABASE_SERVICE_ROLE_KEY carries no NEXT_PUBLIC_ prefix, so Next never
 * inlines it into a browser bundle, and createAdminClient() throws on a missing key.
 * The secret cannot leak even if this guard were removed; the guard is there to make
 * the mistake loud rather than subtle.
 *
 * Modules used ONLY by the App Router should keep `import "server-only"` -- a build
 * error beats a runtime one whenever you can have it.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "This module is server-only and must never be imported from client code.",
  );
}

export {};
