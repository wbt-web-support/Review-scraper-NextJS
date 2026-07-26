"use client";

import { useState } from "react";
import * as tus from "tus-js-client";
import type { CollectionPage } from "@vrm/lib/collect/queries";
import { formatVideoLength } from "@vrm/lib/video/limits";
import { StarRating } from "./star-rating";
import { Recorder } from "./recorder";

type Step = "intro" | "video" | "text" | "details" | "done";
type Mode = "video" | "text";

type BunnyUpload = {
  provider: "bunny";
  tus: {
    endpoint: string;
    libraryId: string;
    videoId: string;
    signature: string;
    expire: number;
  };
};

type SupabaseUpload = {
  provider: "supabase";
  signedUrl: string;
  token: string;
  path: string;
};

type VideoUpload = BunnyUpload | SupabaseUpload;

/** 'video/webm;codecs=vp9,opus' -> 'video/webm' */
function baseMimeType(type: string): string {
  return (type || "video/webm").split(";")[0].trim();
}

/** Direct browser -> Bunny. The API key is never here; only a short-lived signature is. */
function uploadToBunny(
  file: File,
  { tus: params }: BunnyUpload,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: params.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000],
      headers: {
        AuthorizationSignature: params.signature,
        AuthorizationExpire: String(params.expire),
        VideoId: params.videoId,
        LibraryId: params.libraryId,
      },
      metadata: { filetype: file.type, title: file.name },
      onError: reject,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

/**
 * Direct browser -> Supabase Storage, via a signed URL scoped to one object path.
 *
 * XHR rather than fetch, purely because fetch still cannot report upload progress
 * — and on a phone uploading 40MB over 4G, a progress bar is the difference
 * between waiting and giving up.
 */
function uploadToSupabase(
  file: File,
  upload: SupabaseUpload,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload.signedUrl, true);
    // MediaRecorder reports 'video/webm;codecs=vp9,opus'. The bucket's
    // allowed_mime_types matches on the bare type, so the codec suffix has to go or
    // Supabase 415s the upload.
    xhr.setRequestHeader("Content-Type", baseMimeType(file.type));
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));

    xhr.send(file);
  });
}

function uploadVideo(
  file: File,
  upload: VideoUpload,
  onProgress: (percent: number) => void,
): Promise<void> {
  return upload.provider === "bunny"
    ? uploadToBunny(file, upload, onProgress)
    : uploadToSupabase(file, upload, onProgress);
}

export function CollectForm({ page }: { page: CollectionPage }) {
  const { tenant, promptQuestions, welcomeText, description, thankYouText, maxVideoSeconds } = page;
  const brand = tenant.brandColor;

  const [step, setStep] = useState<Step>("intro");
  const [mode, setMode] = useState<Mode>("video");

  const [video, setVideo] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    // The server re-validates all of this. These checks exist only so the reviewer
    // gets an instant, specific message instead of a round-trip.
    if (!name.trim()) return setError("Enter your name.");
    if (!rating) return setError("Choose a star rating.");
    if (!consent) return setError("Please tick the consent box to submit.");
    if (mode === "text" && !text.trim()) return setError("Write a short review.");
    if (mode === "video" && !video) return setError("Record or upload a video.");

    setSubmitting(true);
    setProgress(0);

    try {
      const res = await fetch(`/api/collect/${tenant.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode,
          reviewerName: name.trim(),
          reviewerEmail: email.trim(),
          rating,
          consentGiven: consent,
          ...(mode === "text"
            ? { textReview: text.trim() }
            : { contentType: baseMimeType(video?.type ?? "") }),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");

      if (mode === "video" && json.upload && video) {
        await uploadVideo(video, json.upload as VideoUpload, setProgress);
      }

      setStep("done");

      // When embedded in the widget's dialog, tell the parent we're finished so it
      // can close itself after the thank-you shows. targetOrigin is "*" because the
      // parent is the client's own website and we cannot know its origin -- safe
      // here, since the message carries no data beyond "a review was submitted".
      if (window.parent !== window) {
        window.parent.postMessage({ type: "vrm:submitted" }, "*");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------ thank you
  if (step === "done") {
    return (
      <div className="text-center">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${brand}22` }}
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke={brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">
          {thankYouText}
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          {tenant.name} will review it shortly.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ------------------------------------------------------------- intro */}
      {step === "intro" && (
        <div>
          <h1 className="collect-title">{welcomeText}</h1>
          {description && <p className="collect-description">{description}</p>}

          {promptQuestions.length > 0 && (
            <div className="collect-prompts">
              <div className="collect-prompts-label">A few things to talk about</div>
              {promptQuestions.map((q) => (
                <div key={q} className="collect-prompt">
                  <span aria-hidden className="collect-dot" />
                  <span>{q}</span>
                </div>
              ))}
            </div>
          )}

          <div className="collect-actions">
            <button
              type="button"
              onClick={() => {
                setMode("video");
                setStep("video");
              }}
              className="collect-btn-primary"
            >
              <span className="collect-btn-label">
                <span className="collect-rec">
                  {/* Stays red on every brand: a brand-coloured record dot stops
                      reading as a record dot. No spinner -- it read as a loader. */}
                  <span aria-hidden className="collect-rec-dot" />
                </span>
                Record a video
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- video */}
      {step === "video" && (
        <div>
          <BackLink onClick={() => setStep("intro")} />
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
            Record your review
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Keep it under {formatVideoLength(maxVideoSeconds)}. Just talk naturally.
          </p>

          <div className="mt-6">
            {/* The recorder owns the record -> preview -> re-record/save flow. Saving
                the previewed video advances to the details step. */}
            <Recorder
              brandColor={brand}
              maxSeconds={maxVideoSeconds}
              onVideo={setVideo}
              onSave={() => setStep("details")}
            />
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------- text */}
      {step === "text" && (
        <div>
          <BackLink onClick={() => setStep("intro")} />
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
            Write your review
          </h2>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={5000}
            placeholder="What did we do, and how did it go?"
            className="mt-6 block w-full rounded-field border border-muted bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-offset-0"
            style={{ outlineColor: brand }}
          />

          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => setStep("details")}
            className="mt-6 w-full rounded-field bg-ink px-5 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------- details */}
      {step === "details" && (
        <div>
          <BackLink onClick={() => setStep(mode === "video" ? "video" : "text")} />
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
            Almost done
          </h2>

          <div className="mt-6 space-y-6">
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-medium text-ink">
                Your name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className="block w-full rounded-field border border-muted bg-surface px-3.5 py-2.5 text-sm text-ink focus:outline-2 focus:outline-offset-0"
                style={{ outlineColor: brand }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email <span className="text-ink-muted">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="block w-full rounded-field border border-muted bg-surface px-3.5 py-2.5 text-sm text-ink focus:outline-2 focus:outline-offset-0"
                style={{ outlineColor: brand }}
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-ink">Your rating</span>
              <StarRating value={rating} onChange={setRating} brandColor={brand} />
            </div>

            {/* GDPR. Required, unticked by default, and enforced again server-side
                and by a CHECK constraint in the database. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-field border border-muted bg-base p-4">
              <input
                id="consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                className="mt-0.5 size-4 shrink-0 rounded border-muted"
                style={{ accentColor: brand }}
              />
              <span className="text-sm text-ink">
                I agree that {tenant.name} can publish this review, including my
                name{mode === "video" ? " and video" : ""}, on their website and
                marketing.
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-field bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                {error}
              </p>
            )}

            {submitting && mode === "video" && (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${progress}%`, backgroundColor: brand }}
                  />
                </div>
                <p className="mt-2 text-center text-sm text-ink-muted">
                  Uploading your video… {progress}%
                </p>
              </div>
            )}

            {/* Neutral, not brand: the brand colour is reserved for the record
                button. The final submit is a plain dark action. */}
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="w-full rounded-field bg-ink px-5 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-ink-muted transition-colors hover:text-ink"
    >
      ← Back
    </button>
  );
}
