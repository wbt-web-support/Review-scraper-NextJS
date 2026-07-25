import "@vrm/lib/server-guard";

import { promises as dns } from "node:dns";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import { deleteStoredVideo, isDirectVideo } from "@vrm/lib/video/provider";
import { getBunnyConfig, getBunnyVideoMeta } from "@vrm/lib/bunny/client";
import { bunnyPlayUrl } from "@vrm/lib/bunny/urls";
import {
  addDomainToVercel,
  removeDomainFromVercel,
  getVercelDomainStatus,
  isVercelConfigured,
  type DnsRecord,
} from "@vrm/lib/vercel/client";
import {
  normalizeRootDomain,
  reviewHostFor,
  cnameTarget,
  isValidDomain,
} from "@vrm/lib/domains/domain";
import {
  MIN_VIDEO_SECONDS,
  MAX_VIDEO_SECONDS,
  formatVideoLength,
} from "@vrm/lib/video/limits";

/**
 * Native tenant management for the scraper app.
 *
 * Every function here is a reimplementation of a Video Review Manager operation
 * (moderation, collection settings, branding, custom domain, video length, API key)
 * for callers that authenticate with NextAuth instead of Supabase -- i.e. the
 * business profile page in THIS project. They exist so the scraper never has to hand
 * a user off to the /video/* screens (a different login) to manage their tenant.
 *
 * They all take a tenantId and use the service-role admin client, which bypasses RLS.
 * That is ONLY safe because the caller has already proven, via resolveOwnedTenant,
 * that this tenantId belongs to a business they own. Do not call these without that
 * check first.
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export type TenantReview = {
  id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  video_guid: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  transcript: string | null;
  text_review: string | null;
  type: "video" | "text";
  status: ReviewStatus;
  created_at: string;
  /**
   * A directly downloadable video file, for saving a copy (e.g. marketing). Computed
   * server-side so the Bunny CDN host stays server-side. Null while a Bunny video is
   * still encoding, or when there's no file to hand (see downloadUrlFor).
   */
  download_url: string | null;
  /** Stored file size in bytes, null if unknown. */
  size_bytes: number | null;
  /** Video length in seconds (Bunny only; direct videos are measured in the browser). */
  duration_seconds: number | null;
  /** Human label of where the video lives, e.g. "Bunny Stream · Library 12345". */
  storage_label: string | null;
  /** A link to open the stored video where it lives. */
  storage_url: string | null;
};

export type ReviewCounts = Record<ReviewStatus | "all", number>;

export type TenantBundle = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    embed_key: string;
    api_key: string;
    logo_url: string | null;
    brand_color: string;
    contact_email: string | null;
    contact_phone: string | null;
    custom_domain: string | null;
    custom_domain_verified: boolean;
    review_open_mode: "dialog" | "page";
    max_video_seconds: number;
  };
  collection: { prompt_questions: string[]; welcome_text: string; thank_you_text: string };
  widget: { layout: "grid" | "carousel" | "single"; autoplay: boolean };
  dns: { records: DnsRecord[]; serving: boolean };
  counts: ReviewCounts;
  /** Bunny library id, so the UI can build a player URL. Null if Bunny isn't set up. */
  bunnyLibraryId: string | null;
  limits: { min: number; max: number };
};

const TENANT_COLUMNS =
  "id, name, slug, subdomain, embed_key, api_key, logo_url, brand_color, contact_email, contact_phone, custom_domain, custom_domain_verified, review_open_mode, max_video_seconds";

/** Everything the tenant-management tabs need, for one tenant. */
export async function getTenantBundle(tenantId: string): Promise<TenantBundle | null> {
  const admin = createAdminClient();

  const { data: tenant, error } = await admin
    .from("tenants")
    .select(TENANT_COLUMNS)
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!tenant) return null;

  const [{ data: collection }, { data: widget }, { data: reviewRows }] = await Promise.all([
    admin
      .from("collection_settings")
      .select("prompt_questions, welcome_text, thank_you_text")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("widget_settings")
      .select("layout, autoplay")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin.from("reviews").select("status").eq("tenant_id", tenantId),
  ]);

  const counts: ReviewCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };
  for (const r of reviewRows ?? []) {
    counts.all++;
    counts[(r as { status: ReviewStatus }).status]++;
  }

  const t = tenant as TenantBundle["tenant"];
  let dnsResult: TenantBundle["dns"] = { records: [], serving: t.custom_domain_verified };
  if (t.custom_domain) {
    const status = await getVercelDomainStatus(t.custom_domain, cnameTarget());
    dnsResult = status.skipped
      ? {
          records: [{ type: "CNAME", name: t.custom_domain.split(".")[0], value: cnameTarget() }],
          serving: t.custom_domain_verified,
        }
      : { records: status.records, serving: status.serving };
  }

  const rawQuestions = collection?.prompt_questions;
  return {
    tenant: t,
    collection: {
      prompt_questions: Array.isArray(rawQuestions)
        ? rawQuestions.filter((q): q is string => typeof q === "string")
        : [],
      welcome_text: collection?.welcome_text ?? "",
      thank_you_text: collection?.thank_you_text ?? "",
    },
    widget: {
      layout: (widget?.layout as TenantBundle["widget"]["layout"]) ?? "grid",
      autoplay: widget?.autoplay ?? false,
    },
    dns: dnsResult,
    counts,
    bunnyLibraryId: getBunnyConfig()?.libraryId ?? null,
    limits: { min: MIN_VIDEO_SECONDS, max: MAX_VIDEO_SECONDS },
  };
}

/**
 * A directly downloadable video file for a review, or null.
 *
 * A Supabase-stored file IS the download. For a Bunny video, MP4 Fallback serves a real
 * file at `{cdnHostname}/{guid}/play_720p.mp4`, built straight from the GUID -- we do
 * NOT wait on `video_url` for this, because that column is only set by the encode
 * webhook, which Bunny's cloud can't reach on localhost. So the button would never show
 * in dev otherwise. The file exists once Bunny finishes encoding (a click before then
 * 404s briefly). Requires MP4 Fallback enabled on the library with 720p.
 */
function downloadUrlFor(row: { video_guid: string | null; video_url: string | null }): string | null {
  if (isDirectVideo(row.video_url)) return row.video_url;
  const cfg = getBunnyConfig();
  if (row.video_guid && cfg) {
    return `https://${cfg.cdnHostname}/${row.video_guid}/play_720p.mp4`;
  }
  return null;
}

/** Best-effort byte size of a directly served file, from its HEAD content-length. */
async function headContentLength(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const len = res.headers.get("content-length");
    const n = len ? Number(len) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Where a review's video lives + how big/long it is, for the details on the card. */
async function mediaFactsFor(row: {
  video_guid: string | null;
  video_url: string | null;
}): Promise<Pick<TenantReview, "size_bytes" | "duration_seconds" | "storage_label" | "storage_url">> {
  const direct = isDirectVideo(row.video_url);
  const cfg = getBunnyConfig();

  if (direct && row.video_url) {
    return {
      size_bytes: await headContentLength(row.video_url),
      duration_seconds: null, // read in the browser for direct files
      storage_label: "Supabase Storage",
      storage_url: row.video_url,
    };
  }
  if (row.video_guid && cfg) {
    const meta = await getBunnyVideoMeta(row.video_guid);
    return {
      size_bytes: meta.storageSize,
      duration_seconds: meta.length,
      storage_label: `Bunny Stream · Library ${cfg.libraryId}`,
      storage_url: bunnyPlayUrl(cfg.libraryId, row.video_guid),
    };
  }
  return { size_bytes: null, duration_seconds: null, storage_label: null, storage_url: null };
}

/**
 * The source URL + a friendly filename for downloading one review's video, or null.
 *
 * Used by the download proxy: it fetches this URL server-side and streams it back as an
 * attachment, so the browser saves the file instead of playing it (the `download`
 * attribute is ignored cross-origin, which Bunny's CDN is).
 */
export async function getReviewDownloadSource(
  tenantId: string,
  reviewId: string,
): Promise<{ url: string; filename: string } | null> {
  const { data } = await createAdminClient()
    .from("reviews")
    .select("reviewer_name, video_guid, video_url")
    .eq("id", reviewId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;

  const url = downloadUrlFor(data as { video_guid: string | null; video_url: string | null });
  if (!url) return null;

  const safeName = (data.reviewer_name || "review").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  const ext = url.includes(".mp4") ? "mp4" : url.includes(".webm") ? "webm" : "mp4";
  return { url, filename: `review-${safeName || "video"}.${ext}` };
}

export async function listTenantReviews(
  tenantId: string,
  status?: ReviewStatus,
): Promise<TenantReview[]> {
  const admin = createAdminClient();
  let query = admin
    .from("reviews")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => {
      const r = row as { video_guid: string | null; video_url: string | null };
      return {
        ...(row as TenantReview),
        download_url: downloadUrlFor(r),
        ...(await mediaFactsFor(r)),
      };
    }),
  );
}

export async function setReviewStatus(
  tenantId: string,
  reviewId: string,
  status: ReviewStatus,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("reviews")
    .update({ status })
    .eq("id", reviewId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

/**
 * Delete a review AND its video. Video first, then the row -- the other order orphans
 * the video (still stored, still billed, holding a customer's face) with nothing left
 * that knows it exists. See the note in the VRM original.
 */
export async function deleteTenantReview(tenantId: string, reviewId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: review } = await admin
    .from("reviews")
    .select("id, video_guid")
    .eq("id", reviewId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!review) throw new Error("That review no longer exists.");

  if (review.video_guid) await deleteStoredVideo(review.video_guid); // never throws

  const { error } = await admin
    .from("reviews")
    .delete()
    .eq("id", review.id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

export async function updateCollection(
  tenantId: string,
  input: { welcomeText: string; thankYouText: string; promptQuestions: string[] },
): Promise<void> {
  const questions = input.promptQuestions.map((q) => q.trim()).filter(Boolean).slice(0, 10);
  const { error } = await createAdminClient()
    .from("collection_settings")
    .update({
      welcome_text: input.welcomeText,
      thank_you_text: input.thankYouText,
      prompt_questions: questions,
    })
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

export async function updateWidgetSettings(
  tenantId: string,
  input: { layout: "grid" | "carousel" | "single"; autoplay: boolean },
): Promise<void> {
  const { error } = await createAdminClient()
    .from("widget_settings")
    .update({ layout: input.layout, autoplay: input.autoplay })
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

export async function updateBranding(
  tenantId: string,
  input: { name: string; brandColor: string; logoUrl?: string; contactEmail?: string; contactPhone?: string },
): Promise<void> {
  const { error } = await createAdminClient()
    .from("tenants")
    .update({
      name: input.name,
      brand_color: input.brandColor,
      logo_url: input.logoUrl || null,
      contact_email: input.contactEmail || null,
      contact_phone: input.contactPhone || null,
    })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);
}

export async function setVideoLimit(tenantId: string, seconds: number): Promise<string> {
  if (!Number.isInteger(seconds) || seconds < MIN_VIDEO_SECONDS || seconds > MAX_VIDEO_SECONDS) {
    throw new Error(`Pick a length between ${MIN_VIDEO_SECONDS} and ${MAX_VIDEO_SECONDS} seconds.`);
  }
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ max_video_seconds: seconds })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);
  return `Videos are now capped at ${formatVideoLength(seconds)}.`;
}

export async function setOpenMode(tenantId: string, mode: "dialog" | "page"): Promise<void> {
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ review_open_mode: mode })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);
}

export async function rotateApiKey(tenantId: string): Promise<string> {
  const key = `vrm_${randomBytes(24).toString("hex")}`;
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ api_key: key })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);
  return key;
}

/**
 * Claim (or clear) a custom domain. Claiming is not verifying -- the domain serves
 * nothing until verifyCustomDomain confirms DNS points at us.
 */
export async function saveCustomDomain(
  tenantId: string,
  rootDomain: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  if (!rootDomain.trim()) {
    const { data: existing } = await admin
      .from("tenants")
      .select("custom_domain")
      .eq("id", tenantId)
      .maybeSingle();
    if (existing?.custom_domain) await removeDomainFromVercel(existing.custom_domain);
    const { error } = await admin
      .from("tenants")
      .update({ custom_domain: null, custom_domain_verified: false })
      .eq("id", tenantId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: "Custom domain removed." };
  }

  const root = normalizeRootDomain(rootDomain);
  if (!root) return { ok: false, error: "That doesn't look like a domain. Try something like njdesignpark.com" };
  const host = reviewHostFor(root);

  const { error } = await admin
    .from("tenants")
    .update({ custom_domain: host, custom_domain_verified: false })
    .eq("id", tenantId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That domain is already connected to another account." };
    return { ok: false, error: error.message };
  }

  const attached = await addDomainToVercel(host);
  if (!attached.ok) return { ok: false, error: attached.error };

  return {
    ok: true,
    message: isVercelConfigured()
      ? "Saved and registered with the host. Add the DNS record below, then verify."
      : "Saved. Add the DNS record below, then verify.",
  };
}

/** Verify the tenant controls the domain, by resolving its DNS. */
export async function verifyCustomDomain(
  tenantId: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("custom_domain")
    .eq("id", tenantId)
    .maybeSingle();

  const host = tenant?.custom_domain;
  if (!host || !isValidDomain(host)) return { ok: false, error: "Add a domain first." };

  const target = cnameTarget();
  let pointsAtUs = false;
  try {
    const cnames = await dns.resolveCname(host);
    pointsAtUs = cnames.some((v) => v.replace(/\.$/, "").toLowerCase() === target.toLowerCase());
  } catch {
    try {
      const [hostIps, targetIps] = await Promise.all([dns.resolve4(host), dns.resolve4(target)]);
      pointsAtUs = hostIps.some((ip) => targetIps.includes(ip));
    } catch {
      pointsAtUs = false;
    }
  }
  if (!pointsAtUs) {
    return { ok: false, error: `${host} isn't pointing at us yet. Add the CNAME below and try again — DNS can take up to an hour.` };
  }

  const status = await getVercelDomainStatus(host, target);
  if (!status.skipped && !status.serving) {
    const attached = await addDomainToVercel(host);
    if (!attached.ok) return { ok: false, error: attached.error };
    const recheck = await getVercelDomainStatus(host, target);
    if (!recheck.skipped && !recheck.serving) {
      return { ok: false, error: `DNS is correct, but the host isn't serving ${host} yet. It usually takes a minute to issue the certificate — try again shortly.` };
    }
  }

  const { error } = await admin
    .from("tenants")
    .update({ custom_domain_verified: true })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: `${host} is live.` };
}
