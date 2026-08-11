import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import {
  requireTenant,
  unauthorized,
  badRequest,
  notFound,
  serverError,
  NO_STORE,
} from "@vrm/lib/api/auth";
import { getReviewDownloadSource } from "@/lib/tenantAdmin";

/**
 * Download one review's video file.
 *
 *   curl -H "Authorization: Bearer vrm_..." \
 *        -o testimonial.mp4 \
 *        "https://host/api/v1/reviews/<id>/download"
 *
 * Why this proxies rather than handing back a URL: the file lives on Bunny's CDN,
 * on a different origin, where a browser's `download` attribute is ignored and the
 * video just plays in a tab. Fetching it here and re-sending it with
 * Content-Disposition: attachment is what actually makes it save. It also keeps the
 * CDN host out of the client's reach, so the storage layer stays ours to change.
 *
 * The bytes are STREAMED, not buffered. A three-minute testimonial is tens of
 * megabytes and there is no reason for all of it to sit in this process's memory
 * at once, especially with several clients pulling their archives at the same time.
 * (The older dashboard proxy at pages/api/business-urls/[id]/tenant/download.ts
 * does buffer, because the Pages Router response API gives it no better option.)
 *
 * Scoped by tenant, like everything else here: getReviewDownloadSource matches the
 * review id against the tenant the key resolved to, so a guessed uuid belonging to
 * another business returns the same 404 as one that never existed.
 */

export async function GET(
  request: NextRequest,
  // Next 16: params is a Promise.
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return badRequest("That is not a valid review id.");
  }

  try {
    const source = await getReviewDownloadSource(tenant.id, id);
    if (!source) {
      // Either no such review for this tenant, a text review, or a video whose
      // file does not exist yet. All the same answer: there is nothing to download.
      return notFound("No downloadable video for this review.");
    }

    const upstream = await fetch(source.url);
    if (!upstream.ok || !upstream.body) {
      // Nearly always a Bunny video still encoding its MP4. That is a "come back
      // shortly", not a "something is broken", so say which.
      return NextResponse.json(
        { error: "The video isn't ready to download yet. Try again shortly." },
        { status: 409, headers: NO_STORE },
      );
    }

    const headers = new Headers(NO_STORE);
    headers.set("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
    headers.set("Content-Disposition", `attachment; filename="${source.filename}"`);
    // Passed through when the CDN gives it, so clients get a real progress bar.
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error(`GET /api/v1/reviews/${id}/download failed:`, err);
    return serverError("Could not fetch the video.");
  }
}
