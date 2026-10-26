import "server-only";

import { createAdminClient } from "@vrm/lib/supabase/admin";
import { deleteStoredVideo, prepareVideoUpload, type VideoUpload } from "@vrm/lib/video/provider";
import {
  DEFAULT_MAX_VIDEO_SECONDS,
  OVER_LIMIT_GRACE_SECONDS,
  formatVideoLength,
} from "@vrm/lib/video/limits";
import { getApiReview, isMissingSourceColumn, type ApiReview } from "@vrm/lib/api/reviews";
import type { ApiTenant } from "@vrm/lib/api/auth";

/**
 * A business adding testimonial videos it already has.
 *
 * Built for Command HQ's "Upload your old reviews": a trade business with a
 * folder of customer videos from before they had a collection page. The same
 * two-step shape as the collect form, because video bytes cannot pass through
 * this server (Vercel caps a request body at ~4.5MB):
 *
 *   1. POST /api/v1/uploads   writes the review row and returns a credential
 *                             scoped to that one video
 *   2. the caller's browser   sends the file straight to Bunny (or Storage)
 *   3. PATCH /reviews/{id}    {"status":"approved"} once the bytes have arrived
 *
 * THE ROW STARTS HIDDEN ("rejected"), not pending and not approved. The widget
 * shows every approved video review with a GUID, whether or not its file ever
 * arrived, so a review approved before its upload finished -- or one whose
 * upload was abandoned halfway -- would put a dead player on the business's
 * website. Hidden keeps it off the widget AND out of the "waiting on you" count,
 * which a business's own upload has no business inflating. Step 3 is the caller
 * saying "the file is there; put it live".
 *
 * What a business may not do here, on purpose: set a status, a date or a
 * source. It is always "uploaded", always today, and always starts hidden.
 */

export type ApiUploadCredential =
  | {
      provider: "bunny";
      /** Bunny's TUS endpoint. */
      endpoint: string;
      library_id: string;
      video_id: string;
      /** SHA256 signature for this one video. Send as AuthorizationSignature. */
      signature: string;
      /** UNIX seconds. Send as AuthorizationExpire. At least an hour away. */
      expire: number;
    }
  | {
      provider: "supabase";
      /** One-shot signed URL: PUT the file here with its Content-Type. */
      signed_url: string;
      path: string;
    };

export type UploadInput = {
  reviewerName: string;
  reviewerEmail: string | null;
  rating: number;
  contentType: string;
  /** As read by the uploader's browser. Bunny's encode webhook is the real check. */
  durationSeconds: number;
};

/** The account's own length limit. Agency-set, so a business can read it but not change it. */
export async function maxVideoSecondsFor(tenantId: string): Promise<number> {
  const { data } = await createAdminClient()
    .from("tenants")
    .select("max_video_seconds")
    .eq("id", tenantId)
    .maybeSingle();
  return data?.max_video_seconds ?? DEFAULT_MAX_VIDEO_SECONDS;
}

function toCredential(upload: VideoUpload): ApiUploadCredential {
  if (upload.provider === "bunny") {
    return {
      provider: "bunny",
      endpoint: upload.tus.endpoint,
      library_id: upload.tus.libraryId,
      video_id: upload.tus.videoId,
      signature: upload.tus.signature,
      expire: upload.tus.expire,
    };
  }
  return { provider: "supabase", signed_url: upload.signedUrl, path: upload.path };
}

export type StartUploadResult =
  | { ok: true; review: ApiReview; upload: ApiUploadCredential; maxVideoSeconds: number }
  | { ok: false; status: 400 | 500 | 503; error: string };

export async function startApiUpload(tenant: ApiTenant, input: UploadInput): Promise<StartUploadResult> {
  const maxSeconds = await maxVideoSecondsFor(tenant.id);

  // Refused here so nothing is created, rather than uploaded in full and then
  // rejected and deleted by the encode webhook minutes later. Same grace as the
  // webhook, so a video this lets through is never one the webhook throws out.
  if (input.durationSeconds > maxSeconds + OVER_LIMIT_GRACE_SECONDS) {
    return {
      ok: false,
      status: 400,
      error: `This video is ${formatVideoLength(Math.round(input.durationSeconds))} long. The limit for this account is ${formatVideoLength(maxSeconds)}.`,
    };
  }

  const video = await prepareVideoUpload(
    tenant.id,
    // Bunny knows a video only by its GUID; a readable title is what makes it
    // findable from Bunny's own dashboard. Same order as the collect form's.
    [tenant.name, input.reviewerName, input.reviewerEmail || "no email", "uploaded"].join(" · "),
    input.contentType,
  );

  const { data, error } = await createAdminClient()
    .from("reviews")
    .insert({
      tenant_id: tenant.id, // from the key, never from the body
      reviewer_name: input.reviewerName,
      reviewer_email: input.reviewerEmail,
      rating: input.rating,
      video_guid: video.videoGuid,
      video_url: video.videoUrl,
      type: "video",
      status: "rejected", // hidden until the caller says the file is there; see above
      source: "uploaded",
      // The business has told us they hold the customer's permission; the caller
      // refuses to send this without a box ticked saying so.
      consent_given: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Nothing points at the video we just reserved, so it would sit in Bunny
    // unseen and billed. Removed before answering.
    await deleteStoredVideo(video.videoGuid);
    if (error) console.error("POST /api/v1/uploads insert failed:", error.message);
    if (isMissingSourceColumn(error)) {
      return { ok: false, status: 503, error: "Uploading is not switched on for this service yet." };
    }
    return { ok: false, status: 500, error: "Could not save the review." };
  }

  const review = await getApiReview(tenant.id, data.id);
  if (!review) return { ok: false, status: 500, error: "Could not read the review back." };

  return { ok: true, review, upload: toCredential(video.upload), maxVideoSeconds: maxSeconds };
}
