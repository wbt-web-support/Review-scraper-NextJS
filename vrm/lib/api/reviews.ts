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
 * nothing else: no caller-supplied tenant id is read anywhere in this module, so
 * there is no parameter to tamper with.
 */

export type ApiTenant = { id: string; name: string; slug: string };

/**
 * Resolves the bearer token to a tenant. Returns null for any bad key, without
 * distinguishing "no such key" from "malformed" -- an attacker learns nothing
 * either way.
 */
export async function tenantForApiKey(key: string | null): Promise<ApiTenant | null> {
  if (!key || !key.startsWith("vrm_")) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, slug")
    .eq("api_key", key)
    .maybeSingle();

  return data ?? null;
}

/** `Authorization: Bearer vrm_...`, or the `?key=` fallback some no-code tools force. */
export function apiKeyFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return new URL(request.url).searchParams.get("key");
}

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
  created_at: string;
};

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

  let query = admin
    .from("reviews")
    .select(
      "id, reviewer_name, reviewer_email, rating, type, status, text_review, video_guid, video_url, thumbnail_url, created_at",
      { count: "exact" },
    )
    // The only thing standing between one client and another's testimonials.
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.status) query = query.eq("status", params.status);
  if (params.type) query = query.eq("type", params.type);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const reviews: ApiReview[] = (data ?? []).map((row) => ({
    id: row.id,
    reviewer_name: row.reviewer_name,
    reviewer_email: row.reviewer_email,
    rating: row.rating,
    type: row.type,
    status: row.status,
    text_review: row.text_review,
    video: toVideo(row),
    created_at: row.created_at,
  }));

  return { reviews, total: count ?? reviews.length };
}
