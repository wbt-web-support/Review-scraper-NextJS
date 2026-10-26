import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, serverError } from "@vrm/lib/api/auth";
import { verifyAgencyRequest } from "@vrm/lib/api/agency";
import { createAdminClient } from "@vrm/lib/supabase/admin";

/**
 * GET /api/agency/v1/tenants
 *
 * Every business, for Command HQ's "pick their reviews business" list. Names and
 * web addresses only: no keys, no contact details, no review counts. Command HQ
 * asks for one business's key separately, and only once a person has picked it.
 *
 * Signed requests only; see vrm/lib/api/agency.ts.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAgencyRequest(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await createAdminClient()
    .from("tenants")
    .select("id, name, slug, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("GET /api/agency/v1/tenants failed:", error.message);
    return serverError("Could not load the businesses.");
  }

  return NextResponse.json({ tenants: data ?? [] }, { headers: NO_STORE });
}
