/**
 * The video length limit.
 *
 * Shared by the browser (the recorder counts against it) and the server (the
 * admin form validates against it, and the Bunny webhook enforces it), so this
 * module is deliberately NOT "server-only" and must stay free of node imports.
 *
 * The figure itself lives on the tenant row -- see tenants.max_video_seconds.
 * These are the bounds around it and the vocabulary for talking about it.
 */

/** Matches the column default in the migration. Used when a row somehow lacks one. */
export const DEFAULT_MAX_VIDEO_SECONDS = 180;

/** Matches tenants_max_video_seconds_check. Keep the two in step. */
export const MIN_VIDEO_SECONDS = 15;
export const MAX_VIDEO_SECONDS = 1800;

/**
 * How far over the limit an encoded video may run before the server rejects it.
 *
 * MediaRecorder does not stop on a frame boundary, and Bunny rounds its reported
 * length up, so a recording capped at 180s routinely encodes as 181s. Without
 * slack the server would reject videos its own recorder produced.
 */
export const OVER_LIMIT_GRACE_SECONDS = 15;

/** What the agency can pick from. Any value in bounds is valid; these are the sane ones. */
export const VIDEO_LENGTH_OPTIONS = [30, 60, 90, 120, 180, 300, 600] as const;

/** 90 -> "1 min 30 sec". For prose and for the admin dropdown. */
export function formatVideoLength(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const mins = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

  return rest === 0 ? mins : `${minutes} min ${rest} sec`;
}

/** 90 -> "01:30". For the recording timer, where a fixed width stops the layout jumping. */
export function formatClock(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}
