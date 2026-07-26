import "@vrm/lib/server-guard";

import { createHash } from "node:crypto";

/**
 * Bunny Stream.
 *
 * The API key is a full-access credential for the video library, so it must never
 * reach the browser. But videos are far too large to proxy through our own server
 * (Vercel caps a request body at ~4.5MB -- about 15 seconds of phone video), so we
 * cannot receive the bytes either.
 *
 * The resolution is TUS with a pre-signed upload: our server creates the video
 * record and hands the browser a short-lived signature. The browser then uploads
 * straight to Bunny. The key stays here, no video bytes touch us, and the upload
 * is resumable -- which matters a great deal when the reviewer is a customer
 * standing in a driveway on 4G.
 */

const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";
const API_BASE = "https://video.bunnycdn.com/library";

export type BunnyConfig = {
  libraryId: string;
  apiKey: string;
  cdnHostname: string;
};

/**
 * Read lazily rather than at module load: the collection page's text-review path
 * works perfectly well without Bunny configured, and it would be absurd for a
 * missing video credential to take down text reviews too.
 */
export function getBunnyConfig(): BunnyConfig | null {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME;

  if (!libraryId || !apiKey || !cdnHostname) return null;
  return { libraryId, apiKey, cdnHostname };
}

export function isBunnyConfigured(): boolean {
  return getBunnyConfig() !== null;
}

/**
 * Creates the video record. Returns its GUID. No bytes are uploaded here.
 *
 * `collectionId` is the tenant's folder. Pass null and the video lands in the root
 * of the library, mixed in with every other client's -- which is exactly what the
 * collections exist to prevent, so callers should be passing one.
 */
export async function createBunnyVideo(
  title: string,
  collectionId?: string | null,
): Promise<string> {
  const config = getBunnyConfig();
  if (!config) throw new Error("Bunny Stream is not configured.");

  const res = await fetch(`${API_BASE}/${config.libraryId}/videos`, {
    method: "POST",
    headers: {
      AccessKey: config.apiKey,
      "Content-Type": "application/json",
    },
    // Bunny rejects a null collectionId, so omit the key entirely rather than
    // sending one.
    body: JSON.stringify(collectionId ? { title, collectionId } : { title }),
  });

  if (!res.ok) {
    throw new Error(`Bunny createVideo failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { guid?: string };
  if (!json.guid) throw new Error("Bunny createVideo returned no guid.");
  return json.guid;
}

/**
 * A collection is Bunny's folder-inside-a-library. One per tenant.
 *
 * Bunny does NOT enforce unique names, so calling this twice makes two folders
 * with the same label and no complaint. The caller owns "exactly one per tenant" --
 * see ensureTenantCollection, which is the only thing that should call this.
 */
export async function createBunnyCollection(name: string): Promise<string> {
  const config = getBunnyConfig();
  if (!config) throw new Error("Bunny Stream is not configured.");

  const res = await fetch(`${API_BASE}/${config.libraryId}/collections`, {
    method: "POST",
    headers: {
      AccessKey: config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    throw new Error(`Bunny createCollection failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { guid?: string };
  if (!json.guid) throw new Error("Bunny createCollection returned no guid.");
  return json.guid;
}

/**
 * Moves an existing video into a collection. Bunny's update endpoint is a POST to
 * the video itself; only the fields sent are changed.
 *
 * This is what the backfill leans on: videos created before collections existed sit
 * in the library root, and this is the only way to file them.
 */
export async function setBunnyVideoCollection(
  videoGuid: string,
  collectionId: string,
): Promise<boolean> {
  const config = getBunnyConfig();
  if (!config) return false;

  const res = await fetch(`${API_BASE}/${config.libraryId}/videos/${videoGuid}`, {
    method: "POST",
    headers: {
      AccessKey: config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ collectionId }),
  });

  if (!res.ok) {
    console.error(`Bunny updateVideo failed: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

/**
 * Removes the collection itself.
 *
 * Bunny does not promise that this deletes the videos inside it, so callers must
 * delete the videos FIRST and treat this as removing the empty folder. Getting that
 * order wrong orphans the videos: still stored, still billed, now unfiled.
 */
export async function deleteBunnyCollection(collectionId: string): Promise<void> {
  const config = getBunnyConfig();
  if (!config) return;

  const res = await fetch(`${API_BASE}/${config.libraryId}/collections/${collectionId}`, {
    method: "DELETE",
    headers: { AccessKey: config.apiKey },
  });

  if (!res.ok) {
    console.error(`Bunny deleteCollection failed: ${res.status} ${await res.text()}`);
  }
}

export type TusUploadParams = {
  endpoint: string;
  libraryId: string;
  videoId: string;
  signature: string;
  expire: number;
};

/**
 * Pre-signed TUS credentials for one specific video.
 *
 * Signature is SHA256(library_id + api_key + expiration_time + video_id), hex.
 * `expire` is UNIX SECONDS -- milliseconds here is the classic mistake and shows
 * up as a 401 from the TUS endpoint with no further explanation.
 *
 * The signature is scoped to a single videoId that we just created and bound to
 * one tenant's review row, so handing it to an anonymous reviewer grants them
 * exactly one thing: the ability to put bytes into that one video.
 */
export function createTusUploadParams(videoId: string, ttlSeconds = 3600): TusUploadParams {
  const config = getBunnyConfig();
  if (!config) throw new Error("Bunny Stream is not configured.");

  // Bunny recommends at least an hour, so a slow mobile upload doesn't expire
  // mid-flight.
  const expire = Math.floor(Date.now() / 1000) + Math.max(ttlSeconds, 3600);

  const signature = createHash("sha256")
    .update(`${config.libraryId}${config.apiKey}${expire}${videoId}`)
    .digest("hex");

  return {
    endpoint: TUS_ENDPOINT,
    libraryId: config.libraryId,
    videoId,
    signature,
    expire,
  };
}

/**
 * The encoded length, in seconds. Null when Bunny isn't configured, doesn't know
 * the video, or hasn't worked the length out yet (it reports 0 until it encodes).
 *
 * This is the only trustworthy measure of how long a video actually is. The
 * recorder's own clock runs in the reviewer's browser, and the browser holds a TUS
 * signature -- so a caller who skips our UI can put any length of video into the
 * library. Read the length back from the source.
 */
export async function getBunnyVideoLength(videoGuid: string): Promise<number | null> {
  const config = getBunnyConfig();
  if (!config) return null;

  const res = await fetch(`${API_BASE}/${config.libraryId}/videos/${videoGuid}`, {
    headers: { AccessKey: config.apiKey },
  });
  if (!res.ok) {
    console.error(`Bunny getVideo failed: ${res.status} ${await res.text()}`);
    return null;
  }

  const json = (await res.json()) as { length?: number };
  return typeof json.length === "number" && json.length > 0 ? json.length : null;
}

/**
 * Length (seconds) and stored size (bytes) for a Bunny video, in one GET.
 *
 * Both come straight from the library, so they're the honest figures (see the note on
 * getBunnyVideoLength). Any field is null when Bunny isn't configured, doesn't know the
 * video, or hasn't finished encoding it yet.
 */
export async function getBunnyVideoMeta(
  videoGuid: string,
): Promise<{ length: number | null; storageSize: number | null; ready: boolean }> {
  const config = getBunnyConfig();
  if (!config) return { length: null, storageSize: null, ready: false };

  const res = await fetch(`${API_BASE}/${config.libraryId}/videos/${videoGuid}`, {
    headers: { AccessKey: config.apiKey },
  });
  if (!res.ok) {
    console.error(`Bunny getVideo failed: ${res.status} ${await res.text()}`);
    return { length: null, storageSize: null, ready: false };
  }

  // Bunny status: 4 = Finished (all renditions, incl. the MP4 fallback, exist). Until
  // then play_720p.mp4 404s, so the player must wait. 5/6 are errors.
  const json = (await res.json()) as { length?: number; storageSize?: number; status?: number };
  return {
    length: typeof json.length === "number" && json.length > 0 ? json.length : null,
    storageSize: typeof json.storageSize === "number" && json.storageSize > 0 ? json.storageSize : null,
    ready: json.status === 4,
  };
}

/** Removes the video from the library. Storage and egress are billed, so orphans cost money. */
export async function deleteBunnyVideo(videoGuid: string): Promise<void> {
  const config = getBunnyConfig();
  if (!config) return;

  const res = await fetch(`${API_BASE}/${config.libraryId}/videos/${videoGuid}`, {
    method: "DELETE",
    headers: { AccessKey: config.apiKey },
  });

  // Worth knowing about, but never worth failing the caller for: the review row is
  // already dealt with, and the worst case is a video we keep paying for.
  if (!res.ok) {
    console.error(`Bunny deleteVideo failed: ${res.status} ${await res.text()}`);
  }
}

/** HLS playlist. Bunny transcodes asynchronously, so this 404s until encoding finishes. */
export function playbackUrl(videoGuid: string): string | null {
  const config = getBunnyConfig();
  if (!config) return null;
  return `https://${config.cdnHostname}/${videoGuid}/playlist.m3u8`;
}

export function thumbnailUrl(videoGuid: string): string | null {
  const config = getBunnyConfig();
  if (!config) return null;
  return `https://${config.cdnHostname}/${videoGuid}/thumbnail.jpg`;
}
