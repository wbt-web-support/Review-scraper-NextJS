import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v4";
import { NO_STORE, notFound, serverError } from "@vrm/lib/api/auth";
import { verifyAgencyRequest } from "@vrm/lib/api/agency";
import { createAdminClient } from "@vrm/lib/supabase/admin";

/**
 * POST /api/agency/v1/tenants/{id}/api-key
 *
 * One business's vrm_ key, for Command HQ to store (encrypted) against the client
 * a person just connected it to. POST rather than GET so nothing along the way
 * treats it as cacheable, and every read is written to the log by tenant id, so
 * "who read which key, when" can be answered from the deployment's logs.
 *
 * Signed requests only; see vrm/lib/api/agency.ts.
 */
const IdSchema = z.uuid();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAgencyRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = IdSchema.safeParse((await params).id);
  if (!parsed.success) return notFound("No such business.");

  const { data, error } = await createAdminClient()
    .from("tenants")
    .select("id, name, slug, api_key")
    .eq("id", parsed.data)
    .maybeSingle();

  if (error) {
    console.error("POST /api/agency/v1/tenants/[id]/api-key failed:", error.message);
    return serverError("Could not read that business.");
  }
  if (!data?.api_key) return notFound("No such business.");

  // The id only, never the key.
  console.info(`Agency API: Command HQ read the API key of tenant ${data.id}.`);

  return NextResponse.json(
    { tenant: { id: data.id, name: data.name, slug: data.slug }, api_key: data.api_key },
    { headers: NO_STORE },
  );
}
