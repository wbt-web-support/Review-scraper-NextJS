import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@vrm/lib/env";
import { parseClaims } from "@vrm/lib/auth/claims";

const PROTECTED_PREFIXES = ["/video/admin", "/video/dashboard"];
const AUTH_PAGES = ["/video/login"];

/**
 * Refreshes the Supabase session and does an optimistic redirect.
 *
 * This is NOT the authorization boundary -- see src/lib/auth/dal.ts. Its real job
 * is rotating the refresh token so long-lived tabs don't silently expire. The
 * redirects are a UX convenience layered on top.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Mirror onto the request, so the RSC render downstream sees the fresh
        // token...
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // ...then rebuild the response and mirror onto that, so the browser
        // actually receives the Set-Cookie headers. Both halves are required.
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Must be the first await after createServerClient, with nothing in between:
  // this call is what triggers refresh-token rotation.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims
    ? parseClaims(data.claims as unknown as Record<string, unknown>)
    : null;

  const { pathname } = request.nextUrl;

  // Never redirect API traffic to an HTML login page -- let the route handler run
  // its own check and return a real 401/403.
  const isApi = pathname.startsWith("/api");

  // Only redirect document GETs. A Server Function is a POST to the route that
  // hosts it; redirecting one would corrupt the action's response.
  const isDocumentGet = request.method === "GET";

  if (!isApi && isDocumentGet) {
    const wantsProtected = PROTECTED_PREFIXES.some((p) =>
      pathname.startsWith(p),
    );

    if (wantsProtected && !claims) {
      return redirectPreservingCookies(request, response, "/video/login");
    }

    if (AUTH_PAGES.includes(pathname) && claims?.role) {
      const home = claims.role === "super_admin" ? "/video/admin" : "/video/dashboard";
      return redirectPreservingCookies(request, response, home);
    }

    // Deliberately NOT role-gating /admin vs /dashboard here. That belongs in the
    // DAL, which is the only layer that actually enforces it.
  }

  return response;
}

/**
 * If getClaims() rotated the token, `carrier` holds fresh Set-Cookie headers. A
 * bare NextResponse.redirect() would discard them and log the user out -- which
 * presents as users being randomly signed out whenever a refresh happens to
 * coincide with a redirect.
 */
function redirectPreservingCookies(
  request: NextRequest,
  carrier: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const redirect = NextResponse.redirect(url);
  for (const cookie of carrier.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
