import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import {
  playbackUrl,
  thumbnailUrl,
  getBunnyConfig,
  getBunnyVideoLength,
  deleteBunnyVideo,
} from "@vrm/lib/bunny/client";
import { DEFAULT_MAX_VIDEO_SECONDS, OVER_LIMIT_GRACE_SECONDS } from "@vrm/lib/video/limits";

/**
 * Bunny encode webhook.
 *
 * A video is unplayable until Bunny finishes transcoding, so video_url and
 * thumbnail_url stay null on the review row until this fires. Status is NOT
 * touched: encoding finishing does not mean a human approved it. Every review
 * still waits for the tenant admin.
 *
 * Bunny does not sign its webhooks. So this endpoint is public, and its only
 * protection is that it is not exploitable: we look the review up by video_guid
 * (a 36-char GUID we generated and never published), and the only thing a caller
 * can achieve is setting the playback URL of a video that already exists, to the
 * URL it would have had anyway -- the URLs are derived from our own config, not
 * from the request body. There is nothing to forge.
 */

// Bunny status codes. 4 = finished, 5 = failed. Anything below 4 is in progress.
const STATUS_FINISHED = 4;
const STATUS_FAILED = 5;

const WebhookSchema = z.object({
  VideoGuid: z.string().min(1),
  Status: z.coerce.number().int(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = WebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { VideoGuid: videoGuid, Status: status } = parsed.data;

  if (status < STATUS_FINISHED) {
    // Still encoding. Acknowledge, or Bunny will retry.
    return NextResponse.json({ ok: true, ignored: "still encoding" });
  }

  if (!getBunnyConfig()) {
    console.error("Bunny webhook received but Bunny is not configured.");
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  if (status === STATUS_FAILED) {
    // Leave the row pending with no video. The tenant admin sees a review with no
    // playable video and can reject it. Better than silently deleting a customer's
    // submission.
    console.error(`Bunny encoding failed for video ${videoGuid}`);
    return NextResponse.json({ ok: true });
  }

  // ---------------------------------------------------------- length enforcement
  //
  // This is where the tenant's max_video_seconds is actually enforced. The recorder
  // stops itself at the limit and refuses an over-length upload, but it runs in the
  // reviewer's browser and holds a TUS signature, so neither check binds anyone who
  // skips our UI. Bunny's own reported length does.
  //
  // Only reachable for Bunny. On the Supabase Storage fallback there is no encoder
  // and nothing to ask, so the bucket's 50MB cap is the only ceiling there.
  const { data: review } = await admin
    .from("reviews")
    .select("id, tenant_id")
    .eq("video_guid", videoGuid)
    .maybeSingle();

  // A GUID we have no review for. Nothing to do, and nothing to be alarmed about:
  // a review deleted between upload and encode lands here.
  if (!review) return NextResponse.json({ ok: true, ignored: "unknown video" });

  const { data: tenant } = await admin
    .from("tenants")
    .select("max_video_seconds")
    .eq("id", review.tenant_id)
    .maybeSingle();

  const maxSeconds = tenant?.max_video_seconds ?? DEFAULT_MAX_VIDEO_SECONDS;
  const length = await getBunnyVideoLength(videoGuid);

  if (length !== null && length > maxSeconds + OVER_LIMIT_GRACE_SECONDS) {
    // Reject rather than delete the row: the tenant should be able to see that
    // something was submitted and thrown out, not just wonder. The video itself
    // goes, because storing it is a bill we said we would not pay.
    const { error } = await admin
      .from("reviews")
      .update({ status: "rejected", video_url: null, thumbnail_url: null })
      .eq("id", review.id);

    if (error) {
      console.error("Bunny webhook reject failed:", error.message);
      return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }

    await deleteBunnyVideo(videoGuid);

    console.warn(
      `Rejected video ${videoGuid}: ${Math.round(length)}s exceeds the ${maxSeconds}s limit for tenant ${review.tenant_id}.`,
    );
    return NextResponse.json({ ok: true, rejected: "over the length limit" });
  }

  // reviews.video_guid is UNIQUE, so this is idempotent: a redelivered webhook
  // just rewrites the same two derived URLs.
  const { error } = await admin
    .from("reviews")
    .update({
      video_url: playbackUrl(videoGuid),
      thumbnail_url: thumbnailUrl(videoGuid),
    })
    .eq("video_guid", videoGuid);

  if (error) {
    console.error("Bunny webhook update failed:", error.message);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
