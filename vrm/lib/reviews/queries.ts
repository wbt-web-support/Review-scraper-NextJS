import "server-only";

import { createClient } from "@vrm/lib/supabase/server";
import { getTenantContext, requireRole } from "@vrm/lib/auth/dal";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type ReviewType = "video" | "text";

export type Review = {
  id: string;
  tenant_id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  video_guid: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  transcript: string | null;
  text_review: string | null;
  type: ReviewType;
  status: ReviewStatus;
  created_at: string;
};

export type ReviewFilters = {
  status?: ReviewStatus;
  rating?: number;
};

/**
 * The current tenant's reviews.
 *
 * The .eq('tenant_id', ...) is not redundant. For a tenant_admin, RLS already
 * restricts the rows -- but a super_admin impersonating a tenant can see EVERY
 * tenant's reviews under RLS, so this filter is what makes "view as" show one
 * tenant instead of all of them.
 */
export async function listReviews(filters: ReviewFilters = {}): Promise<Review[]> {
  const { tenantId } = await getTenantContext();
  const supabase = await createClient();

  let query = supabase
    .from("reviews")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.rating) query = query.eq("rating", filters.rating);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Review[];
}

export type ReviewCounts = Record<ReviewStatus | "all", number>;

export async function reviewCounts(): Promise<ReviewCounts> {
  const { tenantId } = await getTenantContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("status")
    .eq("tenant_id", tenantId);
  if (error) throw error;

  const counts: ReviewCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of data ?? []) {
    counts.all++;
    counts[row.status as ReviewStatus]++;
  }
  return counts;
}

/**
 * One named tenant's reviews, for the agency.
 *
 * Distinct from listReviews() because the super admin here is NOT impersonating:
 * they are looking at a tenant from /admin, with no view-as cookie set, so
 * getTenantContext would bounce them to /admin rather than answer. The tenant is
 * named in the URL instead.
 *
 * requireRole is the gate. Under RLS a super_admin can read every tenant's rows,
 * which is exactly what makes this work and exactly why a tenant_admin must never
 * reach it: for them the tenantId argument would be an open door to a competitor's
 * testimonials. It is not enough that only an admin page calls this today.
 */
export async function listReviewsForTenant(
  tenantId: string,
  filters: ReviewFilters = {},
): Promise<Review[]> {
  await requireRole("super_admin");
  const supabase = await createClient();

  let query = supabase
    .from("reviews")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function reviewCountsForTenant(tenantId: string): Promise<ReviewCounts> {
  await requireRole("super_admin");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("status")
    .eq("tenant_id", tenantId);
  if (error) throw error;

  const counts: ReviewCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of data ?? []) {
    counts.all++;
    counts[row.status as ReviewStatus]++;
  }
  return counts;
}



