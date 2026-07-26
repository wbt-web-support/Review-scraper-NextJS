import { useState } from "react";
import { Maximize2, X } from "lucide-react";

export interface ReviewVideoSource {
  videoGuid: string | null;
  /**
   * The direct, playable video file (the server's `download_url`): a Supabase object,
   * or a Bunny `play_720p.mp4`. Null while a Bunny video is still encoding -- the server
   * only fills it once the file actually exists, so we never point <video> at a 404.
   */
  fileUrl: string | null;
  thumbnailUrl?: string | null;
  /** Present but unused now; kept so callers don't need to change. */
  libraryId?: string | null;
  reviewerName?: string;
  /** Fires once the browser knows the file's length. */
  onDuration?: (seconds: number) => void;
}

/**
 * Plays a review video inside its card, from the direct file.
 *
 * A plain <video> (not the Bunny iframe): it shows a preview frame, plays inline, and
 * has no referrer/allowed-domain check -- the embed player's check is what left cards
 * black on localhost. No file yet (still encoding, or a load hiccup) shows "Processing".
 */
export function ReviewVideo({ videoGuid, fileUrl, thumbnailUrl, reviewerName, onDuration }: ReviewVideoSource) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const canPlay = Boolean(fileUrl) && !failed;
  // No poster image? Nudge the browser to render the first frame as the preview.
  const src = fileUrl ? (thumbnailUrl ? fileUrl : `${fileUrl}#t=0.1`) : "";

  const Player = ({ big }: { big?: boolean }) => (
    <video
      src={src}
      poster={thumbnailUrl ?? undefined}
      controls
      autoPlay={big}
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) onDuration?.(d);
      }}
      className="h-full w-full bg-black object-contain"
    />
  );

  return (
    <>
      <div className="group relative h-full w-full overflow-hidden bg-gray-900">
        {canPlay ? (
          <Player />
        ) : videoGuid ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
            <span className="text-sm">Processing video…</span>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-500">No video</div>
        )}

        {canPlay && (
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
      {open && canPlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(false)}>
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
