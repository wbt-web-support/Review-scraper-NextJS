import { isDirectVideo } from "@vrm/lib/video/provider";
import { bunnyEmbedUrl } from "@vrm/lib/bunny/urls";

/**
 * Plays a review video from either provider.
 *
 * Bunny serves HLS. Safari plays it natively; Chrome and Firefox do not -- so a
 * plain <video src=playlist.m3u8> silently shows nothing for most of the audience.
 * Rather than ship hls.js (~150kb), use Bunny's own iframe player.
 *
 * The Supabase Storage fallback has no transcoding, so the file is whatever the
 * browser recorded and a plain <video> is exactly right.
 *
 * Server component either way: no client JS.
 */
export function VideoPlayer({
  videoGuid,
  videoUrl,
  thumbnailUrl,
  libraryId,
}: {
  videoGuid: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  libraryId: string | null;
}) {
  // Direct file (Supabase Storage fallback).
  if (isDirectVideo(videoUrl ?? null)) {
    return (
      <video
        controls
        preload="metadata"
        playsInline
        poster={thumbnailUrl ?? undefined}
        src={videoUrl!}
        className="aspect-video w-full rounded-field bg-ink"
      />
    );
  }

  // Bunny.
  if (libraryId) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-field bg-ink">
        <iframe
          src={bunnyEmbedUrl(libraryId, videoGuid)}
          loading="lazy"
          className="absolute inset-0 size-full"
          allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
          title="Customer video review"
          referrerPolicy="strict-origin"
        />
      </div>
    );
  }

  // A Bunny-era row, but Bunny is no longer configured. Say so rather than
  // rendering a dead frame.
  return (
    <div className="flex aspect-video items-center justify-center rounded-field border border-muted bg-base">
      <p className="px-4 text-center text-sm text-ink-muted">
        This video is hosted on Bunny Stream. Add your Bunny credentials to play it.
      </p>
    </div>
  );
}
