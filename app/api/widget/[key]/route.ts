import { NextResponse, type NextRequest } from "next/server";
import { getWidgetPayloadByEmbedKey } from "@vrm/lib/widget/queries";

/**
 * Public JSON feed for the embed widget.
 *
 * CORS is wide open because that is the entire point: this is consumed from every
 * client's own website, on domains we do not control and cannot enumerate. What
 * makes that safe is not the origin check (there isn't one, and there can't be) --
 * it is that the payload contains only approved reviews for exactly one tenant,
 * with PII stripped in the query. See src/lib/widget/queries.ts.
 *
 * Cached at the CDN, so a testimonial page going viral hits Postgres once a
 * minute rather than once a visitor.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  request: NextRequest,
  // Next 16: params is a Promise.
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  // The widget is embedded on someone else's website, so it cannot work out OUR
  // origin. Compute it here and hand it over pre-baked, for the fallback when the
  // tenant has no verified custom domain.
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  const payload = await getWidgetPayloadByEmbedKey(key, `${proto}://${host}`);
  if (!payload) {
    // Deliberately vague. Confirming which keys exist would let someone enumerate
    // the agency's client list.
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  return NextResponse.json(payload, {
    headers: {
      ...CORS,
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
