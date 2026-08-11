import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import {
  requireTenant,
  unauthorized,
  badRequest,
  serverError,
  firstZodError,
  NO_STORE,
} from "@vrm/lib/api/auth";
import { listApiReviews } from "@vrm/lib/api/reviews";

/**
 * GET /api/v1/reviews
 *
 *   curl -H "Authorization: Bearer vrm_..." \
 *        "https://host/api/v1/reviews?status=approved&type=video&limit=50"
 *
 * The client's own reviews, for their own system. Authenticated by the tenant's
 * secret api_key, which resolves the tenant; there is no tenant parameter to pass
 * and therefore none to forge.
 *
 * NO CORS HEADERS, deliberately. This returns pending reviews and reviewer emails,
 * so a browser calling it would have to ship the secret key to every visitor. The
 * absence of an Access-Control-Allow-Origin header is what makes that mistake fail
 * loudly in development instead of quietly leaking a client's customer list. Call
 * it server-to-server. The public, browser-safe feed already exists: it is
 * /api/widget/<embed_key>.
 */

const MAX_LIMIT = 100;

const QuerySchema = z.object({
  // Default to approved: it is what a client wants on their own site, and it is
  // the safe default -- nobody accidentally publishes an unmoderated review.
  status: z.enum(["pending", "approved", "rejected", "all"]).default("approved"),
  type: z.enum(["video", "text"]).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return badRequest(firstZodError(parsed.error));

  const { status, type, limit, offset } = parsed.data;

  try {
    const { reviews, total } = await listApiReviews(tenant.id, {
      status: status === "all" ? undefined : status,
      type,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        tenant: { name: tenant.name, slug: tenant.slug },
        total,
        limit,
        offset,
        reviews,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("GET /api/v1/reviews failed:", err);
    return serverError("Could not load reviews.");
  }
}
