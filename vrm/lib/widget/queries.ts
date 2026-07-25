import "server-only";

import { createAdminClient } from "@vrm/lib/supabase/admin";
import { titleCaseName } from "@vrm/lib/tenants/display-name";
import { collectUrl } from "./collect-url";

/**
 * The public widget feed.
 *
 * This is the endpoint that made `anon` get zero table privileges. The tempting
 * alternative was an RLS policy: `for select to anon using (status = 'approved')`.
 * It is broken, and worth spelling out why, because it looks reasonable:
 *
 *   anon has no tenant claim. So that policy's predicate is `status = 'approved'`,
 *   full stop -- there is nothing to scope it by. The anon key sits in the HTML of
 *   every customer's website. Anyone could lift it and GET /rest/v1/reviews with NO
 *   tenant filter, dumping every approved testimonial from every client of the
 *   agency, reviewer_email included. A client-side .eq('tenant_id') is a
 *   suggestion, not a control.
 *
 * So the tenant scoping happens HERE, server-side, where it cannot be removed --
 * and the column allowlist below is what keeps customer PII out of a payload
 * served to the open internet.
 */

export type PublicReview = {
  id: string;
  reviewer_name: string;
  rating: number;
  type: "video" | "text";
  text_review: string | null;
  video_guid: string | null;
  /** Set for Supabase-hosted videos; null on Bunny until its encode webhook fires. */
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
};

export type WidgetPayload = {
  // `slug` is safe to publish: it is already the public collection URL that
  // customers are sent.
  tenant: { name: string; slug: string; brandColor: string; logoUrl: string | null };
  settings: { layout: "grid" | "carousel" | "single"; theme: string; autoplay: boolean };
  /**
   * How "Leave a review" behaves. Agency-controlled, not tenant-controlled.
   *   dialog -> modal on the client's own page (default; best for conversion)
   *   page   -> full page in a new tab, at collectUrl
   */
  openMode: "dialog" | "page";
  /** Pre-computed: the tenant's verified custom domain if they have one, else ours. */
  collectUrl: string;
  libraryId: string | null;
  reviews: PublicReview[];
};

/**
 * NEVER add reviewer_email or transcript to this select. reviewer_email is the
 * personal data of a client's customer; publishing it on a third-party web page
 * would be a straightforward GDPR breach.
 */
const PUBLIC_COLUMNS =
  "id, reviewer_name, rating, type, text_review, video_guid, video_url, thumbnail_url, created_at";

async function loadPayload(
  tenantQuery: {
    column: "embed_key" | "subdomain" | "slug" | "custom_domain";
    value: string;
    /** Custom domains must be DNS-verified before we serve anything on them. */
    requireVerifiedDomain?: boolean;
  },
  limit: number,
  appOrigin: string,
): Promise<WidgetPayload | null> {
  const admin = createAdminClient();

  let query = admin
    .from("tenants")
    .select(
      "id, name, slug, brand_color, logo_url, custom_domain, custom_domain_verified, review_open_mode",
    )
    .eq(tenantQuery.column, tenantQuery.value);

  if (tenantQuery.requireVerifiedDomain) {
    query = query.eq("custom_domain_verified", true);
  }

  const { data: tenant } = await query.maybeSingle();
  if (!tenant) return null;

  const { data: settings } = await admin
    .from("widget_settings")
    .select("layout, theme, autoplay")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const { data: reviews } = await admin
    .from("reviews")
    .select(PUBLIC_COLUMNS)
    // Both filters are explicit and server-side. This is the tenant scoping that
    // an anon RLS policy structurally could not provide.
    .eq("tenant_id", tenant.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    tenant: {
      // Capitalised here, at the one place the public payload is built, so the review
      // wall AND w.js on the client's own website both get it. This is the outward
      // face of the business -- it is worth looking deliberate. Display only: the
      // stored tenants.name is never modified.
      name: titleCaseName(tenant.name),
      slug: tenant.slug,
      brandColor: tenant.brand_color,
      logoUrl: tenant.logo_url,
    },
    settings: {
      layout: (settings?.layout as WidgetPayload["settings"]["layout"]) ?? "grid",
      theme: settings?.theme ?? "light",
      autoplay: settings?.autoplay ?? false,
    },
    openMode: (tenant.review_open_mode as WidgetPayload["openMode"]) ?? "dialog",
    collectUrl: collectUrl({
      origin: appOrigin,
      slug: tenant.slug,
      customDomain: tenant.custom_domain,
      customDomainVerified: tenant.custom_domain_verified,
    }),
    libraryId: process.env.BUNNY_STREAM_LIBRARY_ID ?? null,
    reviews: (reviews ?? []) as PublicReview[],
  };
}

/** Used by the embed widget, which identifies a tenant by its public embed key. */
export function getWidgetPayloadByEmbedKey(embedKey: string, appOrigin: string, limit = 24) {
  return loadPayload({ column: "embed_key", value: embedKey }, limit, appOrigin);
}

/** Used by the subdomain display page (<slug>.ourdomain.com). */
export function getWidgetPayloadBySubdomain(subdomain: string, appOrigin = "", limit = 60) {
  return loadPayload({ column: "subdomain", value: subdomain }, limit, appOrigin);
}

/**
 * Used by the custom-domain page (review.theirdomain.com).
 *
 * requireVerifiedDomain is load-bearing. A tenant can CLAIM any hostname -- there
 * is nothing stopping them typing "review.bbc.co.uk" into the settings form. What
 * stops us serving their reviews on the BBC's domain is that we refuse to render
 * until a DNS lookup has proven they control it.
 */
export function getWidgetPayloadByCustomDomain(host: string, appOrigin = "", limit = 60) {
  return loadPayload(
    { column: "custom_domain", value: host.toLowerCase(), requireVerifiedDomain: true },
    limit,
    appOrigin,
  );
}
