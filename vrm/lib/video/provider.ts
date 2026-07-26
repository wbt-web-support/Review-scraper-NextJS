import "@vrm/lib/server-guard";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import {
  isBunnyConfigured,
  createBunnyVideo,
  createTusUploadParams,
  deleteBunnyVideo,
  type TusUploadParams,
} from "@vrm/lib/bunny/client";
import { ensureTenantCollection, forgetTenantCollection } from "@vrm/lib/bunny/collections";

/**
 * Where review videos live.
 *
 * Bunny Stream is the production path -- it transcodes, serves HLS, makes
 * thumbnails, and its egress is cheap. Supabase Storage is a FALLBACK so the
 * product still works when Bunny isn't configured, rather than the video option
 * simply being dead.
 *
 * The fallback is genuinely worse and it is worth being honest about why:
 * no transcoding (a WebM recorded in Chrome will not play in Safari), no
 * thumbnails, a 50MB cap, and egress billed per GB. Configure Bunny for anything
 * real.
 *
 * Both paths share the same shape: the server mints a credential scoped to ONE
 * object, and the browser uploads directly. Neither ever puts a secret in the
 * browser, and video bytes never pass through our server (which they could not
 * anyway -- Vercel caps a request body at ~4.5MB).
 */

export const VIDEO_BUCKET = "review-videos";

export type VideoProvider = "bunny" | "supabase";

export function getVideoProvider(): VideoProvider {
  return isBunnyConfigured() ? "bunny" : "supabase";
}

export type BunnyUpload = { provider: "bunny"; tus: TusUploadParams };

export type SupabaseUpload = {
  provider: "supabase";
  /** One-shot signed URL; the browser PUTs the file here. */
  signedUrl: string;
  token: string;
  path: string;
};

export type VideoUpload = BunnyUpload | SupabaseUpload;

export type PreparedVideo = {
  /** Bunny GUID, or the storage object path. Stored in reviews.video_guid. */
  videoGuid: string;
  /**
   * Playable URL, if it is knowable up front.
   *
   * Bunny: null. The video is not playable until transcoding finishes, and the
   * encode webhook fills this in.
   *
   * Supabase: the public URL, which is deterministic from the path. There is no
   * webhook and no processing step, so there is nothing to wait for. If the upload
   * is abandoned the URL simply 404s -- the review is still `pending`, so a human
   * sees a video that will not play and rejects it.
   */
  videoUrl: string | null;
  upload: VideoUpload;
};

export async function prepareVideoUpload(
  tenantId: string,
  title: string,
  contentType: string,
): Promise<PreparedVideo> {
  if (getVideoProvider() === "bunny") {
    // The tenant's own folder inside the library, made on their first video. Null
    // only if Bunny could not be asked, in which case the video lands in the root
    // and the backfill script files it later -- see ensureTenantCollection.
    const collectionId = await ensureTenantCollection(tenantId);
    let videoGuid: string;
    try {
      videoGuid = await createBunnyVideo(title, collectionId);
    } catch (err) {
      // A stale collection id (its library was switched, or the folder was deleted)
      // makes Bunny reject the create with "Collection does not exist". Don't lose the
      // testimonial over filing: forget the bad id and put this video in the library
      // root. The next upload mints a fresh folder in the current library.
      if (collectionId && /collection does not exist/i.test(String(err))) {
        await forgetTenantCollection(tenantId);
        videoGuid = await createBunnyVideo(title, null);
      } else {
        throw err;
      }
    }

    return {
      videoGuid,
      videoUrl: null, // arrives via the Bunny encode webhook
      upload: { provider: "bunny", tus: createTusUploadParams(videoGuid) },
    };
  }

  const admin = createAdminClient();

  // Namespaced by tenant, random filename. The path is the only thing standing
  // between an un-approved video and the public, so it must not be guessable.
  const extension = contentType.includes("mp4")
    ? "mp4"
    : contentType.includes("quicktime")
      ? "mov"
      : "webm";
  const path = `${tenantId}/${randomUUID()}.${extension}`;

  // Scoped to exactly this one object path. The reviewer can write there and
  // nowhere else -- the same guarantee the Bunny TUS signature gives.
  const { data, error } = await admin.storage
    .from(VIDEO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Could not create an upload URL: ${error?.message}`);
  }

  const { data: publicUrl } = admin.storage.from(VIDEO_BUCKET).getPublicUrl(path);

  return {
    videoGuid: path,
    videoUrl: publicUrl.publicUrl,
    upload: {
      provider: "supabase",
      signedUrl: data.signedUrl,
      token: data.token,
      path,
    },
  };
}

/**
 * True when a review's video is a direct file rather than a Bunny stream.
 *
 * Used by the players to choose between Bunny's iframe and a plain <video>. Keyed
 * off the URL rather than a new column, so existing rows need no backfill: a Bunny
 * URL is an HLS playlist on the CDN host, a Supabase one is a storage object.
 */
export function isDirectVideo(videoUrl: string | null): boolean {
  return Boolean(videoUrl && videoUrl.includes("/storage/v1/object/public/"));
}

/**
 * Which provider a stored video belongs to, from the GUID alone.
 *
 * A Supabase path is always <tenant_id>/<uuid>.<ext> and therefore always contains
 * a slash. A Bunny GUID never does. Unlike isDirectVideo this needs no video_url,
 * which matters when deleting: a Bunny row has a null video_url right up until the
 * encode webhook fires, and an abandoned upload never gets one at all. Keying the
 * decision off the URL would quietly mistake those for storage objects and leave
 * the Bunny video behind.
 */
export function isStoragePath(videoGuid: string): boolean {
  return videoGuid.includes("/");
}

/**
 * Removes one review's video from wherever it actually lives.
 *
 * NEVER THROWS. A video we failed to delete is a bill and a GDPR liability, and it
 * must be shouted about -- but it must not block the row's deletion, because a
 * review the owner has asked to be rid of, still sitting on their dashboard because
 * a third-party API had a bad minute, is the worse outcome of the two.
 */
export async function deleteStoredVideo(videoGuid: string): Promise<void> {
  if (isStoragePath(videoGuid)) {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(VIDEO_BUCKET).remove([videoGuid]);
    if (error) console.error(`Failed to remove stored video ${videoGuid}:`, error.message);
    return;
  }

  await deleteBunnyVideo(videoGuid);
}
