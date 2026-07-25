"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock, formatVideoLength } from "@vrm/lib/video/limits";

/**
 * Picks a container/codec the browser will actually record.
 *
 * Chrome/Firefox record WebM; Safari records MP4 and does not support WebM at all.
 * Hardcoding either one silently breaks half the audience -- and this audience is
 * a tradesperson's customer on whatever phone they happen to own, so both matter.
 * Bunny transcodes whatever it receives, so we just take the first supported type.
 */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=h264,aac", // Safari
    "video/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * A picked file's duration in seconds, or null when the browser won't say.
 *
 * WebM written by MediaRecorder often carries no duration in its header, so
 * `duration` comes back as Infinity. That is not "too long", it is "unknown" --
 * treat it as acceptable and let the server's length check be the backstop.
 */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");

    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };

    probe.preload = "metadata";
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    probe.src = url;
  });
}

export type RecorderState = "idle" | "ready" | "recording" | "recorded" | "denied" | "unsupported";

export function Recorder({
  brandColor,
  maxSeconds,
  onVideo,
  onSave,
}: {
  brandColor: string;
  /** From tenants.max_video_seconds. The recorder stops itself here. */
  maxSeconds: number;
  onVideo: (file: File | null) => void;
  /** Called when the reviewer accepts the recorded video from the preview. */
  onSave?: () => void;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** Set when the recording was cut short at the limit, so we can say so. */
  const [hitLimit, setHitLimit] = useState(false);
  const [tooLong, setTooLong] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Release the camera when the component goes away. Without this the recording
  // light stays on after the reviewer navigates off, which is alarming.
  useEffect(() => stopStream, [stopStream]);

  // Revoke blob URLs so a few retakes don't leak memory.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /**
   * Swap the <video> from the live camera to the recorded clip once it's ready.
   *
   * The element still holds the live stream in `srcObject`, which the browser
   * prioritises over `src` -- and that stream is now stopped, so it paints a black
   * frame and the recording never shows. Clearing srcObject and pointing src at the
   * local blob (then load()) is what makes the preview actually play. The blob lives
   * entirely in the browser; nothing is uploaded until they submit.
   */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || state !== "recorded" || !previewUrl) return;
    v.srcObject = null;
    v.src = previewUrl;
    v.muted = false;
    v.load();
  }, [state, previewUrl]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  /**
   * The clock, and the hard stop.
   *
   * Elapsed time is measured from a timestamp rather than counted up per tick:
   * a backgrounded tab throttles setInterval to roughly once a second at best, so
   * a counter that adds 1 per tick drifts short and would let a phone that locked
   * mid-recording sail past the limit.
   */
  useEffect(() => {
    if (state !== "recording") return;

    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setSeconds(Math.min(elapsed, maxSeconds));

      if (elapsed >= maxSeconds) {
        setHitLimit(true);
        stopRecording();
      }
    }, 250);

    return () => clearInterval(id);
  }, [state, maxSeconds, stopRecording]);

  async function requestCamera() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState("ready");
    } catch {
      // Denied, or no camera. Either way they need the fallbacks.
      setState("denied");
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = pickMimeType();
    // Compress at capture time. Left uncapped, MediaRecorder targets a very high
    // bitrate (5+ Mbps at 720p), so a short testimonial becomes tens of MB. Capping
    // it -- 2 Mbps video, 128 kbps audio -- roughly halves the file with no visible
    // loss for a talking-head clip, and it applies whether the video lands in Supabase
    // Storage (now) or Bunny (which then transcodes further). VP9 (preferred by
    // pickMimeType) compresses better still.
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond: 128_000,
    });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `review.${ext}`, { type });

      setPreviewUrl(URL.createObjectURL(blob));
      onVideo(file);
      stopStream();
      setState("recorded");
    };

    // A timeslice, so the chunks already on disk survive a stop that arrives from
    // the limit rather than from a click.
    recorder.start(1000);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setSeconds(0);
    setHitLimit(false);
    setTooLong(null);
    setState("recording");
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onVideo(null);
    setSeconds(0);
    setHitLimit(false);
    setTooLong(null);
    setState("idle");
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    // Clear it now, or picking the same file again after a rejection fires no
    // change event and the reviewer is stuck.
    input.value = "";
    if (!file) return;

    const duration = await readDuration(file);
    if (duration !== null && duration > maxSeconds + 1) {
      setTooLong(
        `That video is ${formatClock(duration)} long. Please upload one under ${formatVideoLength(maxSeconds)}.`,
      );
      return;
    }

    setTooLong(null);
    setHitLimit(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    onVideo(file);
    stopStream();
    setState("recorded");
  }

  const remaining = Math.max(0, Math.ceil(maxSeconds - seconds));
  const runningOut = state === "recording" && remaining <= 10;

  return (
    <div className="space-y-4">
      {/* After recording, this is a preview: the reviewer watches it back before
          deciding to keep it or record again. */}
      {state === "recorded" && (
        <p className="text-center text-sm font-medium text-ink">
          Preview your video, then re-record or save it.
        </p>
      )}

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card bg-ink sm:aspect-video">
        {/* muted is required for autoplay of the live preview; the recording still
            captures audio from the stream. */}
        {/* srcObject (live) and src (recorded blob) are both set imperatively -- see
            requestCamera and the state-swap effect -- so React must not manage src here,
            or it would clobber the recorded clip on re-render. object-contain while
            reviewing shows the whole frame rather than cropping it. */}
        <video
          ref={videoRef}
          className={`size-full ${state === "recorded" ? "object-contain" : "object-cover"}`}
          playsInline
          muted={state !== "recorded"}
          autoPlay={state !== "recorded"}
          controls={state === "recorded"}
        />

        {state === "recording" && (
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5">
            <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
            {/* Elapsed against the cap, so the limit is never a surprise. */}
            <span className="font-mono text-sm tabular-nums text-white">
              {formatClock(seconds)}
              <span className={runningOut ? "text-red-400" : "text-white/50"}>
                {" / "}
                {formatClock(maxSeconds)}
              </span>
            </span>
          </div>
        )}

        {(state === "idle" || state === "denied" || state === "unsupported") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {state === "idle" && (
              <>
                <p className="text-sm text-white/80">
                  We&apos;ll ask for camera access next.
                </p>
                <button
                  type="button"
                  onClick={requestCamera}
                  className="rounded-field px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: brandColor }}
                >
                  Turn on camera
                </button>
              </>
            )}
            {state === "denied" && (
              <p className="max-w-xs text-sm text-white/80">
                We couldn&apos;t access your camera. Allow it in your browser
                settings, or upload a video instead.
              </p>
            )}
            {state === "unsupported" && (
              <p className="max-w-xs text-sm text-white/80">
                This browser can&apos;t record video. You can still upload one, or
                write a review.
              </p>
            )}
          </div>
        )}
      </div>

      {tooLong && (
        <p role="alert" className="rounded-field bg-red-50 px-3.5 py-2.5 text-center text-sm text-red-800">
          {tooLong}
        </p>
      )}

      {hitLimit && state === "recorded" && (
        <p role="status" className="text-center text-sm text-ink-muted">
          We stopped at {formatVideoLength(maxSeconds)}, the maximum length. Record
          again if you&apos;d like another go.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {state === "ready" && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            <span className="size-3 rounded-full bg-white" />
            Start recording
          </button>
        )}

        {state === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2.5 rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <span className="size-3 rounded-sm bg-white" />
            Stop
          </button>
        )}

        {state === "recorded" && (
          <>
            <button
              type="button"
              onClick={retake}
              className="rounded-full border border-muted px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-sage-soft"
            >
              Re-record
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className="flex items-center gap-2 rounded-full px-7 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                Save video
              </button>
            )}
          </>
        )}

        {state !== "recording" && state !== "recorded" && (
          <label className="cursor-pointer rounded-full border border-muted px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-sage-soft">
            Upload a video
            {/* capture is intentionally absent: on a phone this lets them pick an
                existing clip from the gallery, not just shoot a new one. */}
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={onFilePicked}
            />
          </label>
        )}
      </div>

      {state === "ready" && (
        <p className="text-center text-xs text-ink-muted">
          Up to {formatVideoLength(maxSeconds)}. We&apos;ll stop the recording there.
        </p>
      )}
    </div>
  );
}
