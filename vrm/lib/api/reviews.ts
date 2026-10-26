import "server-only";

import { createAdminClient } from "@vrm/lib/supabase/admin";
import { getBunnyConfig } from "@vrm/lib/bunny/client";
import { bunnyEmbedUrl, bunnyPlayUrl } from "@vrm/lib/bunny/urls";
import { isDirectVideo } from "@vrm/lib/video/provider";

/**
 * The tenant-facing integration API.
 *
 * A client asked "how do I get my videos into my own system?" and the honest
 * answer is a key and a JSON endpoint, not a second dashboard.
 *
 * This runs on service_role and RLS is therefore NOT the safety net -- the
 * .eq('tenant_id') below is. The tenant is resolved from the api_key and from
 * nothing else (see api/auth.ts): no caller-supplied tenant id is read anywhere in
 * this module, so there is no parameter to tamper with.
 */

export type ApiVideo = {
  /** "bunny" or "supabase". Which host is actually serving the bytes. */
  provider: "bunny" | "supabase";
  /** Bunny GUID, or the storage object path. */
  id: string;
  /**
   * A page that plays the video. This is the one to open, send to someone, or
   * link from your own app. Available immediately, because it is derived from the
   * GUID rather than waiting on the encode webhook.
   */
  play_url: string | null;
  /** Ready-to-paste <iframe> src, if you would rather embed it than link it. */
  embed_url: string | null;
  /**
   * The raw media: an HLS playlist on Bunny, a direct file on the fallback.
   *
   * A MACHINE URL. The Bunny one 403s if a human opens it, and Chrome and Firefox
   * cannot play an .m3u8 without a player library. Only reach for it if you are
   * feeding your own player. It is also null until Bunny's encode webhook fires,
   * which is what `ready` reports.
   */
  url: string | null;
  thumbnail_url: string | null;
  /** False while Bunny is still transcoding: no thumbnail and no `url` yet. */
  ready: boolean;
};

export type ApiReview = {
  id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  type: "video" | "text";
  status: "pending" | "approved" | "rejected";
  text_review: string | null;
  video: ApiVideo | null;
  /**
   * "collected": a customer sent it through the collection page.
   * "uploaded": the business added a video it already had (POST /uploads).
   */
  source: ReviewSource;
  created_at: string;
};

export type ReviewSource = "collected" | "uploaded";

function toVideo(row: {
  video_guid: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
}): ApiVideo | null {
  if (!row.video_guid) return null;

  const direct = isDirectVideo(row.video_url);
  const libraryId = getBunnyConfig()?.libraryId ?? null;

  // Supabase serves one plain file, so every URL is that file. Bunny's are built
  // from the GUID, so they exist before the encode finishes.
  const play = direct
    ? row.video_url
    : libraryId
      ? bunnyPlayUrl(libraryId, row.video_guid)
      : null;

  return {
    provider: direct ? "supabase" : "bunny",
    id: row.video_guid,
    play_url: play,
    embed_url: direct
      ? row.video_url
      : libraryId
        ? bunnyEmbedUrl(libraryId, row.video_guid)
        : null,
    url: row.video_url,
    thumbnail_url: row.thumbnail_url,
    ready: Boolean(row.video_url),
  };
}

/** One list, so a field can never appear on the list route and go missing on the single one. */
const BASE_COLUMNS =
  "id, reviewer_name, reviewer_email, rating, type, status, text_review, video_guid, video_url, thumbnail_url, created_at";
const REVIEW_COLUMNS = `${BASE_COLUMNS}, source`;

/**
 * Postgres "undefined column": reviews.source before migration 20261026130000
 * has been run. Migrations here are applied by hand and a deploy does not wait
 * for them, so for that window the read routes fall back to the columns they had
 * and report every review as "collected" -- which is what every row then is --
 * rather than answering 500 to every integration at once.
 */
export function isMissingSourceColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703";
}

type ReviewRow = {
  id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  type: "video" | "text";
  status: "pending" | "approved" | "rejected";
  text_review: string | null;
  video_guid: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  source?: string | null;
  created_at: string;
};

function toApiReview(row: ReviewRow): ApiReview {
  return {
    id: row.id,
    reviewer_name: row.reviewer_name,
    reviewer_email: row.reviewer_email,
    rating: row.rating,
    type: row.type,
    status: row.status,
    text_review: row.text_review,
    video: toVideo(row),
    source: row.source === "uploaded" ? "uploaded" : "collected",
    created_at: row.created_at,
  };
}

export type ListParams = {
  status?: "pending" | "approved" | "rejected";
  type?: "video" | "text";
  limit: number;
  offset: number;
};

export async function listApiReviews(
  tenantId: string,
  params: ListParams,
): Promise<{ reviews: ApiReview[]; total: number }> {
  const admin = createAdminClient();

  const run = (columns: string) => {
    let query = admin
      .from("reviews")
      .select(columns, { count: "exact" })
      // The only thing standing between one client and another's testimonials.
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.status) query = query.eq("status", params.status);
    if (params.type) query = query.eq("type", params.type);
    return query;
  };

  let { data, error, count } = await run(REVIEW_COLUMNS);
  if (isMissingSourceColumn(error)) ({ data, error, count } = await run(BASE_COLUMNS));
  if (error) throw new Error(error.message);

  const reviews = ((data ?? []) as unknown as ReviewRow[]).map(toApiReview);
  return { reviews, total: count ?? reviews.length };
}

/**
 * One review, scoped to the tenant.
 *
 * Null covers both "no such id" and "belongs to someone else", and the caller
 * turns either into the same 404. Distinguishing them would confirm to a guessing
 * caller that an id exists on another tenant.
 */
export async function getApiReview(
  tenantId: string,
  reviewId: string,
): Promise<ApiReview | null> {
  const run = (columns: string) =>
    createAdminClient()
      .from("reviews")
      .select(columns)
      .eq("id", reviewId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

  let { data, error } = await run(REVIEW_COLUMNS);
  if (isMissingSourceColumn(error)) ({ data, error } = await run(BASE_COLUMNS));
  if (error) throw new Error(error.message);
  return data ? toApiReview(data as unknown as ReviewRow) : null;
}
