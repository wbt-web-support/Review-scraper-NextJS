import "server-only";

/**
 * In-memory fixed-window rate limiter.
 *
 * Honest about what this is: it lives in one process's memory, so it does NOT
 * hold across serverless instances or a restart. It stops a naive script hammering
 * one collection page; it will not stop a distributed flood. Before this carries
 * real traffic, move it to Redis/Upstash or put Cloudflare Turnstile in front of
 * the submit route. It is here because the alternative -- nothing at all on a
 * public, unauthenticated write endpoint -- is worse.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    sweep(now);
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { ok: true };
}

/** Drop expired buckets so the map can't grow without bound. */
function sweep(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Best-effort client IP. Spoofable via headers when not behind a trusted proxy,
 * which is precisely why this is a speed bump and not a security control.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
