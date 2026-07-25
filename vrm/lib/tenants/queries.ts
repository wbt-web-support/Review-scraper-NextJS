import "server-only";

import { createClient } from "@vrm/lib/supabase/server";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import { assertRole } from "@vrm/lib/auth/dal";
import { provisionTenant, provisionTenantAdmin } from "./provision";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  embed_key: string;
  logo_url: string | null;
  brand_color: string;
  custom_domain: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  plan: string;
  created_at: string;
};

export type TenantWithStats = Tenant & {
  review_count: number;
  pending_count: number;
};

/**
 * Every tenant, with review counts.
 *
 * Uses the caller's own (authenticated) client, NOT service_role: the
 * tenants_select policy already restricts this to super_admins, so RLS is doing
 * the authorization. assertRole is belt-and-braces on top -- if someone ever
 * loosens that policy, this still refuses.
 */
export async function listTenants(): Promise<TenantWithStats[]> {
  await assertRole("super_admin");
  const supabase = await createClient();

  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  // One grouped count query rather than N per-tenant queries.
  const { data: reviews, error: reviewErr } = await supabase
    .from("reviews")
    .select("tenant_id, status");
  if (reviewErr) throw reviewErr;

  const counts = new Map<string, { total: number; pending: number }>();
  for (const r of reviews ?? []) {
    const c = counts.get(r.tenant_id) ?? { total: 0, pending: 0 };
    c.total++;
    if (r.status === "pending") c.pending++;
    counts.set(r.tenant_id, c);
  }

  return (tenants ?? []).map((t) => ({
    ...(t as Tenant),
    review_count: counts.get(t.id)?.total ?? 0,
    pending_count: counts.get(t.id)?.pending ?? 0,
  }));
}

export async function getTenant(id: string): Promise<Tenant | null> {
  await assertRole("super_admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Tenant | null;
}




export type RecentReview = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  reviewer_name: string;
  rating: number;
  status: "pending" | "approved" | "rejected";
  type: "video" | "text";
  created_at: string;
};

/**
 * The newest reviews across every tenant.
 *
 * A super_admin's RLS policy matches every row, so this is a plain query -- no
 * service_role needed. assertRole is belt-and-braces: if the policy were ever
 * loosened, this still refuses.
 */
export async function listRecentReviews(limit = 8): Promise<RecentReview[]> {
  await assertRole("super_admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("id, tenant_id, reviewer_name, rating, status, type, created_at, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { tenants, ...review } = row as typeof row & {
      tenants: { name: string } | null;
    };
    return { ...review, tenant_name: tenants?.name ?? "Unknown" } as RecentReview;
  });
}

export type CreateTenantInput = {
  name: string;
  contactEmail: string;
  contactPhone?: string | null;
  brandColor: string;
  logoUrl?: string | null;
  /** The client's own website, e.g. "njdesignpark.com". Optional. */
  rootDomain?: string | null;
  /** Password for the tenant admin login, which uses contactEmail. */
  adminPassword: string;
  plan?: string;
};

/**
 * Provisions a tenant end to end: the tenant row, its default collection and
 * widget settings, and the owner's login.
 *
 * Doing the login here rather than as a separate step afterwards is the point --
 * a tenant with no login is a half-finished tenant that someone has to remember
 * to come back to.
 *
 * Postgres has no cross-service transaction here (the auth user lives in
 * auth.users via the admin API), so the flow compensates by hand: if any later
 * step fails, everything already created is unwound. A tenant with no owner, or
 * an auth user with no profile, are both broken states -- an auth user with no
 * profile can authenticate but gets a token with no role, and would see an empty
 * app forever.
 *
 * The body lives in ./provision.ts, which the review scraper's Create Widget flow
 * also calls -- it authorizes with a NextAuth session instead, so it cannot go
 * through assertRole. This function is the video app's authorized entry point.
 */
export async function createTenant(
  input: CreateTenantInput,
): Promise<{ ok: true; tenant: Tenant } | { ok: false; error: string }> {
  await assertRole("super_admin");

  // The caller's own (authenticated) client, NOT service_role. INSERT on tenants is
  // granted to `authenticated` and gated by the tenants_insert_super_admin policy, so
  // RLS remains the authorization for this path and assertRole is belt and braces on
  // top -- unchanged from when this logic lived inline here.
  const supabase = await createClient();

  return provisionTenant(input, supabase);
}

/**
 * Creates a tenant_admin login for a tenant.
 *
 * service_role is required twice over: auth.admin.createUser is a privileged API,
 * and profiles has no INSERT policy for `authenticated` at all (provisioning is
 * deliberately not something a logged-in user can do).
 */
export async function inviteTenantAdmin(
  tenantId: string,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertRole("super_admin");
  return provisionTenantAdmin(tenantId, email, password);
}
