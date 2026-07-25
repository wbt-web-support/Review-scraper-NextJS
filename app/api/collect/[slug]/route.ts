import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import { submitTextReview, startVideoReview } from "@vrm/lib/collect/queries";
import { rateLimit, clientIp } from "@vrm/lib/collect/rate-limit";

/**
 * Public review submission. No authentication -- reviewers are anonymous members
 * of the public.
 *
 * This runs with service_role and therefore bypasses RLS, so this handler is the
 * authorization boundary. It is why `anon` has zero table privileges: an anon RLS
 * policy could not resolve the slug, could not rate-limit, and could not stop the
 * client sending its own tenant_id or status.
 *
 * Note the schema has no tenant_id and no status field. They are not "ignored if
 * present" -- there is nowhere to put them.
 */

const BaseSchema = z.object({
  reviewerName: z.string().trim().min(1, { error: "Enter your name." }).max(120),
  reviewerEmail: z.union([z.email(), z.literal("")]).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  consentGiven: z.literal(true, { error: "You must agree before submitting." }),
});

const TextSchema = BaseSchema.extend({
  type: z.literal("text"),
  textReview: z.string().trim().min(1, { error: "Write a short review." }).max(5000),
});

const VideoSchema = BaseSchema.extend({
  type: z.literal("video"),
  // Only used to pick a file extension on the storage fallback. Not trusted for
  // anything else -- the bucket's allowed_mime_types is the real gate.
  contentType: z.string().max(100).optional(),
});

const SubmitSchema = z.discriminatedUnion("type", [TextSchema, VideoSchema]);

export async function POST(
  request: NextRequest,
  // Next 16: params is a Promise.
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // A public write endpoint with no throttle is an invitation to fill a client's
  // moderation queue with 100k rows via a curl loop.
  const limit = rateLimit(`collect:${slug}:${clientIp(request.headers)}`, 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: z.prettifyError(parsed.error).split("\n")[0].replace(/^✖\s*/, "") },
      { status: 400 },
    );
  }

  const input = {
    reviewerName: parsed.data.reviewerName,
    reviewerEmail: parsed.data.reviewerEmail || null,
    rating: parsed.data.rating,
    consentGiven: parsed.data.consentGiven,
  };

  if (parsed.data.type === "text") {
    const result = await submitTextReview(slug, {
      ...input,
      textReview: parsed.data.textReview,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  try {
    // Bunny if configured, else Supabase Storage. Either way the browser gets a
    // credential scoped to one video and no secret of ours.
    const result = await startVideoReview(slug, {
      ...input,
      contentType: parsed.data.contentType,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ ok: true, reviewId: result.reviewId, upload: result.upload });
  } catch (err) {
    console.error("startVideoReview failed:", err);
    return NextResponse.json(
      { error: "Could not start the upload. Please try again." },
      { status: 502 },
    );
  }
}
