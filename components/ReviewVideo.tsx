import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import { bunnyEmbedUrl } from "@vrm/lib/bunny/urls";

/** A Supabase-stored file plays directly; anything else is a Bunny HLS video. */
function isDirectVideo(videoUrl: string | null): boolean {
  return Boolean(videoUrl && videoUrl.includes("/storage/v1/object/public/"));
}

export interface ReviewVideoSource {
  videoGuid: string | null;
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  libraryId: string | null;
  reviewerName?: string;
  /** Fires once the browser knows a direct file's length (Bunny reports its own). */
  onDuration?: (seconds: number) => void;
}

/**
 * Plays a review video inside its card.
 *
 * Bunny videos play in the mediadelivery iframe -- which exists the moment the GUID
 * does, so a still-transcoding video shows the Bunny player (and its own progress),
 * not a dead "No video". A Supabase-stored file plays in a native <video>. Either way
 * an expand button opens the same video large in a fullscreen overlay.
 */
export function ReviewVideo({ videoGuid, videoUrl, thumbnailUrl, libraryId, reviewerName, onDuration }: ReviewVideoSource) {
  const [open, setOpen] = useState(false);

  const direct = isDirectVideo(videoUrl);
  const embedUrl = videoGuid && !direct && libraryId ? bunnyEmbedUrl(libraryId, videoGuid) : null;
  const hasPlayer = Boolean(embedUrl) || Boolean(direct && videoUrl);
  const title = reviewerName ? `Review by ${reviewerName}` : "Video review";

  const Player = ({ big }: { big?: boolean }) =>
    embedUrl ? (
      <iframe
        src={embedUrl}
        title={title}
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="h-full w-full"
      />
    ) : direct && videoUrl ? (
      <video
        src={videoUrl}
        poster={thumbnailUrl ?? undefined}
        controls
        autoPlay={big}
        playsInline
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) onDuration?.(d);
        }}
        className="h-full w-full object-contain"
      />
    ) : null;

  return (
    <>
      <div className="group relative h-full w-full overflow-hidden bg-gray-900">
        {hasPlayer ? (
          <Player />
        ) : videoGuid ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            <span className="text-sm">Processing video…</span>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-500">No video</div>
        )}

        {hasPlayer && (
          <button
            onClick={() => setOpen(true)}
            title="Fullscreen"
            className="absolute left-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Fullscreen overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            onClick={() => setOpen(false)}
            title="Close"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-xl bg-black" onClick={(e) => e.stopPropagation()}>
            <Player big />
          </div>
        </div>
      )}
    </>
  );
}
