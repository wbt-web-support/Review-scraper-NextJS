import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import { syncDomainVerification } from "@vrm/lib/domains/verify";

/**
 * The hourly sweep that makes custom domains verify themselves.
 *
 * DNS goes live on the client's schedule, not ours: they add the CNAME in
 * Cloudflare on Tuesday and the record propagates while nobody is looking at
 * anything. This picks those up. Between it, the check on save, the check when
 * settings loads, and the one on the first request to the domain, a correctly
 * pointed domain always ends up serving without a human pressing Verify.
 *
 * Only claimed-but-unverified domains are considered, so the work is bounded by how
 * many are genuinely waiting -- normally none. It never un-verifies: a domain the
 * host has stopped serving is already broken for its visitors, and flipping the flag
 * on a momentary API failure would take working domains down. Clearing stale flags
 * is deliberate, via scripts/vrm/reverify-domains.ts.
 */

// Runs a handful of external calls per waiting domain; the default 10s is tight.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Vercel signs cron requests with CRON_SECRET when it is set. Honour it if it is:
  // this route writes, and it should not be a thing anyone on the internet can poke.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tenants, error } = await createAdminClient()
    .from("tenants")
    .select("id, custom_domain")
    .not("custom_domain", "is", null)
    .eq("custom_domain_verified", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const verified: string[] = [];
  const waiting: string[] = [];

  for (const tenant of tenants ?? []) {
    const host = tenant.custom_domain as string;
    // Sequential on purpose: this is a background job with nobody waiting on it, and
    // hammering the host's API in parallel is how you get rate limited.
    const result = await syncDomainVerification(tenant.id as string, host, {
      verified: false,
      // Registers a domain that never made it onto the project -- but only once its
      // DNS points here, so a typo saved months ago isn't pushed onto the project
      // every hour for the rest of time.
      attach: "when-pointing",
    });
    (result.verifiedNow ? verified : waiting).push(host);
  }

  return NextResponse.json({ checked: tenants?.length ?? 0, verified, waiting });
}
