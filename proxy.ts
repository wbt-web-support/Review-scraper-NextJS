import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@vrm/lib/supabase/proxy-session";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`. This lives at
 * src/proxy.ts (not the repo root) because `app` is at src/app, and the export
 * must be named `proxy` or be the default. There is no middleware.ts here.
 *
 * Do NOT add `export const runtime = ...` -- setting it in a proxy throws. The
 * runtime is Node.js and is not configurable.
 */

/**
 * Our own apex, e.g. "reviews.webuildtrades.com". Tenant subdomains hang off it:
 *   acme.reviews.webuildtrades.com -> /s/acme
 *
 * Unset in dev, where subdomains of localhost are painful -- use /s/<subdomain>.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

/** Labels on our own domain that are the app, never a tenant. */
const APP_HOSTS = new Set(["www", "app", "admin", "api"]);

/**
 * Every hostname this app itself answers on, beyond ROOT_DOMAIN.
 *
 * This exists because the review scraper shares the app now, and it is served on
 * its own domain -- one that has nothing to do with NEXT_PUBLIC_ROOT_DOMAIN. Without
 * listing it here, routeForHost() falls through to `custom` and rewrites the ENTIRE
 * scraper app into /d/<its-own-host>, which resolves no tenant and 404s everything.
 *
 * Comma separated, e.g. "reviews.webuildtrades.com,widgets.webuildtrades.com".
 */
const APP_DOMAINS = new Set(
  (process.env.APP_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
);

/** Hosts that are always the app itself: dev, platform preview URLs, and our own. */
function isPlatformHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".vercel.app") ||
    APP_DOMAINS.has(hostname)
  );
}

type Route =
  | { kind: "app" }
  | { kind: "subdomain"; value: string } // acme.reviews.ourdomain.com
  | { kind: "custom"; value: string }; // review.njdesignpark.com

function routeForHost(host: string): Route {
  const hostname = host.split(":")[0].toLowerCase();

  if (isPlatformHost(hostname)) return { kind: "app" };

  if (ROOT_DOMAIN) {
    if (hostname === ROOT_DOMAIN) return { kind: "app" };

    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const label = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
      // A single label only: "a.b.root" is not a tenant.
      if (!label || label.includes(".") || APP_HOSTS.has(label)) {
        return { kind: "app" };
      }
      return { kind: "subdomain", value: label };
    }
  }

  // Anything else reaching us is a domain the tenant pointed here themselves.
  //
  // Note the proxy does NOT check whether the host is a known, verified tenant --
  // that would mean a database round-trip on every single request, and the docs
  // warn against exactly that (Proxy runs on prefetches too). It just rewrites, and
  // /d/[host] resolves the tenant and 404s if the domain is unknown or unverified.
  return { kind: "custom", value: hostname };
}

/**
 * Paths that mean the same thing on every host and must NOT be rewritten into the
 * per-tenant review-wall route.
 *
 * Without this, review.theirdomain.com/c/acme rewrites to /d/review.theirdomain.com/c/acme
 * -- which is not a route, so the tenant's own branded collection link 404s. Same for
 * the widget's API calls.
 */
function isSharedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/c/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    // The client's own login + review dashboard, served ON their custom domain so
    // they sign in and manage reviews at reviews.theirdomain.com without ever seeing
    // our app's URL. Auth is per-host (host-only cookies, JWT signed with the shared
    // secret), so a session created here stays on this domain.
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/my-reviews" ||
    pathname === "/w.js" ||
    // The video app's own screens, and the review scraper that shares this app.
    // A tenant's custom domain has no business rendering either, but rewriting
    // them into /d/<host> turns a wrong-place-to-be into a hard 404 -- and belt
    // and braces here costs nothing, while a missed path costs a broken page.
    pathname.startsWith("/video/") ||
    pathname.startsWith("/embed/") ||
    pathname.startsWith("/embed-dist/") ||
    pathname === "/widget.js" ||
    pathname.startsWith("/widget-")
  );
}

export async function proxy(request: NextRequest) {
  const route = routeForHost(request.headers.get("host") ?? "");
  const { pathname } = request.nextUrl;

  if (route.kind !== "app" && !isSharedPath(pathname)) {
    // Rewrite, not redirect: the visitor must keep seeing their own domain in the
    // address bar. That is the entire point of a custom domain.
    const url = request.nextUrl.clone();
    const prefix = route.kind === "subdomain" ? "/s/" : "/d/";
    url.pathname = `${prefix}${route.value}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  return await updateSession(request);
}

export const config = {
  /*
   * Everything except static assets and the widget bundle.
   *
   * Deliberately does NOT exclude /api or any page route:
   *   - Server Functions are POSTs to the route that hosts them, so excluding a
   *     path here would silently strip session refresh from every action on it.
   *   - API traffic needs refreshing too, or a long-lived dashboard tab starts
   *     401-ing its own fetches.
   *
   * w.js IS excluded: it is served to third-party sites and carries no session.
   * So are the review scraper's own bundles (widget.js, widget-<layout>.js,
   * embed-dist/*) for the same reason -- they run on client websites, there is no
   * Supabase session to refresh, and every request through here is latency the
   * host page pays for.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|w\\.js|widget\\.js|widget-[^/]*\\.js|embed-dist/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
