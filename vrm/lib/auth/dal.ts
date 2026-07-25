import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@vrm/lib/supabase/server";
import {
  HOME_FOR_ROLE,
  parseClaims,
  type AppRole,
  type SessionClaims,
} from "./claims";

/**
 * The Data Access Layer. THIS is the authorization boundary -- not src/proxy.ts.
 *
 * The Next docs are explicit that Proxy "should not be your only line of
 * defense": it runs before render, can be skipped by a matcher, and is meant for
 * cheap optimistic redirects. Real checks belong as close to the data as
 * possible. So the proxy is a UX nicety, and everything below is the actual gate.
 *
 * cache() memoizes per request/render pass, so calling requireRole() in a layout
 * AND its page AND a server action costs exactly one verification.
 */

/**
 * Verified claims, or null. Never redirects -- safe to call from anywhere,
 * including code that wants to branch rather than bounce.
 */
export const getSessionClaims = cache(
  async (): Promise<SessionClaims | null> => {
    const supabase = await createClient();

    // getClaims() verifies the JWT signature. Two traps this avoids:
    //   - getSession() reads the cookie WITHOUT verifying it. Trivially spoofed.
    //   - getUser().app_metadata comes from the auth.users row, not the token, so
    //     hook-injected claims can be missing there even when the JWT has them.
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;

    return parseClaims(data.claims as unknown as Record<string, unknown>);
  },
);

/** Authenticated, or bounce to /login. Use in layouts and pages. */
export const verifySession = cache(async (): Promise<SessionClaims> => {
  const claims = await getSessionClaims();
  // redirect() throws -- it must never be wrapped in a try/catch.
  if (!claims) redirect("/video/login");
  return claims;
});

/**
 * Authenticated AND holding `role`, or bounce. Use in layouts and pages.
 *
 * Call it in the page too, not just the layout: because of Partial Rendering, a
 * layout does NOT re-render on client-side navigation, so a check that lives only
 * there never re-runs as the user moves around the section.
 */
export const requireRole = cache(
  async (role: AppRole): Promise<SessionClaims> => {
    const claims = await verifySession();

    if (claims.role !== role) {
      // Send them to their own home rather than a dead-end 403.
      redirect(claims.role ? HOME_FOR_ROLE[claims.role] : "/video/login");
    }

    // A tenant_admin without a tenant_id is a broken account (the DB forbids it,
    // but a missing auth hook would also produce it). Fail closed rather than
    // letting an unscoped session reach tenant-scoped queries.
    if (role === "tenant_admin" && !claims.tenantId) {
      redirect("/video/login?error=no_tenant");
    }

    return claims;
  },
);

/**
 * Throwing variant, for Server Actions and Route Handlers.
 *
 * Every server action must call this. A Server Function is a POST to whichever
 * route hosts it -- so a proxy matcher that excludes a path also silently
 * excludes every action on it, and simply moving an action between files can
 * change its proxy coverage. Actions have to authorize themselves.
 */
export async function assertRole(role: AppRole): Promise<SessionClaims> {
  const claims = await getSessionClaims();
  if (!claims) throw new Error("Unauthorized");
  if (claims.role !== role) throw new Error("Forbidden");
  if (role === "tenant_admin" && !claims.tenantId) throw new Error("Forbidden");
  return claims;
}

/** Cookie holding the tenant a super_admin is currently viewing as. */
export const IMPERSONATION_COOKIE = "vrm_impersonate_tenant";

export type TenantContext = {
  tenantId: string;
  /** True when a super_admin is viewing a tenant's dashboard rather than owning it. */
  impersonating: boolean;
};

/**
 * Resolves which tenant the current request is scoped to. Bounces if there isn't
 * one. Use this -- not requireRole('tenant_admin') -- for anything under /dashboard,
 * so super admins can view a tenant's dashboard without a second implementation.
 *
 * The impersonation cookie is ONLY honoured when the verified JWT says the caller
 * is a super_admin. That check is what makes the cookie safe to leave unsigned: a
 * tenant_admin who forges it gets nothing, because their claims never reach the
 * branch that reads it. The tenant_admin path below ignores the cookie entirely
 * and uses the tenant_id baked into their token.
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const claims = await verifySession();

  if (claims.role === "tenant_admin") {
    if (!claims.tenantId) redirect("/video/login?error=no_tenant");
    return { tenantId: claims.tenantId, impersonating: false };
  }

  if (claims.role === "super_admin") {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
    // A super_admin with no tenant selected has no business on /dashboard.
    if (!tenantId) redirect("/video/admin");
    return { tenantId, impersonating: true };
  }

  redirect("/video/login");
});
