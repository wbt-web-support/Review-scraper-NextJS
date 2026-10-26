import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { NO_STORE } from "@vrm/lib/api/auth";
import { rateLimit, clientIp } from "@vrm/lib/collect/rate-limit";

/**
 * The AGENCY API: Command HQ's door into this app.
 *
 * Command HQ connects each of its clients to the right business here. Instead of
 * a person copying every business's vrm_ key out of the dashboard and pasting it
 * across, Command HQ lists the businesses and, for the one picked, reads its key
 * and stores it (encrypted) against that client. Asked for by Rahul, 26 Oct 2026.
 *
 * That makes this the most powerful door in the app -- it can read EVERY
 * business's key -- so it is shut in four ways:
 *
 *   1. ONE SHARED SECRET, server-side only: AGENCY_API_SECRET here, the same value
 *      as VIDEO_REVIEWS_AGENCY_SECRET in Command HQ. No NEXT_PUBLIC_ prefix on
 *      either side, so neither framework can put it in a browser bundle. Unset
 *      (or shorter than 32 characters) and every agency route answers 404, as if
 *      it did not exist.
 *
 *   2. THE SECRET IS NEVER SENT. Each request carries an HMAC-SHA256 signature
 *      over its time, method, path and body. A copied request cannot be pointed
 *      at another path, given another body, or replayed once the
 *      AGENCY_SIGNATURE_WINDOW_SECONDS window has passed.
 *
 *   3. SEPARATE FROM EVERYTHING ELSE. A tenant's vrm_ key, a dashboard login and a
 *      scraper operator session all count for nothing here, and this signature
 *      counts for nothing on /api/v1. No CORS headers, so no web page can call it.
 *
 *   4. RATE-LIMITED per caller address, so guessing is slow as well as hopeless.
 *
 * Signing, which Command HQ mirrors in lib/integrations/videoReviewsAgency.ts:
 *
 *   canonical = `${timestamp}\n${METHOD}\n${path + query}\n${sha256hex(body)}`
 *   X-WBT-Timestamp: unix seconds
 *   X-WBT-Signature: hex HMAC-SHA256(secret, canonical)
 */

export const AGENCY_SIGNATURE_WINDOW_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;
/** Command HQ asks for the list once and a key once per connection. */
const REQUESTS_PER_MINUTE = 60;

function agencySecret(): string | null {
  const secret = process.env.AGENCY_API_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

export function agencyCanonical(method: string, pathWithQuery: string, timestamp: string, body: string): string {
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  return `${timestamp}\n${method.toUpperCase()}\n${pathWithQuery}\n${bodyHash}`;
}

export function agencySignature(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

function deny(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/**
 * Checks a request came from Command HQ. Returns its body (already read, since
 * the signature covers it), or the reply to send.
 *
 * Every refusal says the same thing, whatever was wrong: a caller learns nothing
 * about which part of a forged request gave it away.
 */
export async function verifyAgencyRequest(
  request: Request,
): Promise<{ ok: true; body: string } | { ok: false; response: NextResponse }> {
  const secret = agencySecret();
  if (!secret) return { ok: false, response: deny("Not found.", 404) };

  const limit = rateLimit(`agency:${clientIp(request.headers)}`, REQUESTS_PER_MINUTE, 60_000);
  if (!limit.ok) return { ok: false, response: deny("Too many requests. Try again shortly.", 429) };

  const refused = { ok: false as const, response: deny("Not authorised.", 401) };

  const timestamp = request.headers.get("x-wbt-timestamp") ?? "";
  const signature = (request.headers.get("x-wbt-signature") ?? "").toLowerCase();
  if (!/^\d{9,11}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return refused;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > AGENCY_SIGNATURE_WINDOW_SECONDS) return refused;

  const body = await request.text();
  const url = new URL(request.url);
  const expected = agencySignature(secret, agencyCanonical(request.method, url.pathname + url.search, timestamp, body));

  // Constant time: comparing hex strings with === leaks how many leading
  // characters were right, one timing at a time.
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return refused;

  return { ok: true, body };
}
