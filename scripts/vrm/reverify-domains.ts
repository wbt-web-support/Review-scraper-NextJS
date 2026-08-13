/**
 * Re-verify every claimed custom domain against the host, and flip
 * custom_domain_verified for the ones the host is already serving.
 *
 *   npx tsx --env-file=.env.local scripts/vrm/reverify-domains.ts          # report only
 *   npx tsx --env-file=.env.local scripts/vrm/reverify-domains.ts --apply  # write
 *
 * Why this exists: verifyCustomDomain() used to require the tenant's CNAME to
 * equal NEXT_PUBLIC_CNAME_TARGET exactly. Vercel now issues a PER-PROJECT target
 * (062636747f0bc041.vercel-dns-016.com) alongside the shared cname.vercel-dns.com,
 * and clients paste whichever one the Vercel dashboard showed them. Both serve
 * fine; only one ever matched. Every client on the per-project target stayed
 * unverified, so /d/[host] answered 404 on a domain that was live.
 *
 * The action now asks Vercel instead of string-comparing. This backfills the
 * tenants that were already stuck, so nobody has to press Verify twenty times.
 *
 * It flips a flag ONLY when Vercel reports the domain attached to this project and
 * not misconfigured -- the same evidence of control the action requires. A domain
 * Vercel will not serve stays unverified.
 */
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!VERCEL_TOKEN || !PROJECT_ID) {
  console.error("Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID -- the host is the source of truth.");
  process.exit(1);
}

const team = TEAM_ID ? `?teamId=${encodeURIComponent(TEAM_ID)}` : "";

async function vercel(path: string) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    cache: "no-store",
  });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Attached to THIS project, and Vercel's own DNS check passes. */
async function isServing(domain: string): Promise<{ serving: boolean; why: string }> {
  const attached = await vercel(
    `/v9/projects/${encodeURIComponent(PROJECT_ID!)}/domains/${encodeURIComponent(domain)}${team}`,
  );
  if (!attached.ok) return { serving: false, why: "not attached to the Vercel project" };

  const conf = await vercel(`/v6/domains/${encodeURIComponent(domain)}/config${team}`);
  if (conf.body.misconfigured) return { serving: false, why: "DNS not pointing at Vercel" };

  return { serving: true, why: "attached and configured" };
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, custom_domain, custom_domain_verified")
    .not("custom_domain", "is", null)
    .order("name");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`${tenants!.length} claimed domain(s)${APPLY ? "" : "  [dry run -- pass --apply to write]"}\n`);

  const toVerify: { id: string; domain: string }[] = [];
  const toUnverify: { id: string; domain: string; why: string }[] = [];

  for (const t of tenants!) {
    const domain = t.custom_domain as string;
    const { serving, why } = await isServing(domain);
    const verified = Boolean(t.custom_domain_verified);

    let action = "ok";
    if (serving && !verified) {
      action = "-> VERIFY";
      toVerify.push({ id: t.id as string, domain });
    } else if (!serving && verified) {
      // Serving a domain the host has dropped means 404s or a TLS error either
      // way; flagging it verified just hides that.
      action = `-> UNVERIFY (${why})`;
      toUnverify.push({ id: t.id as string, domain, why });
    } else if (!serving) {
      action = `blocked (${why})`;
    }

    console.log(
      `  ${domain.padEnd(45)} db=${verified ? "verified" : "unverified"}  host=${serving ? "serving" : "not serving"}  ${action}`,
    );
  }

  console.log(`\n${toVerify.length} to verify, ${toUnverify.length} to unverify.`);

  if (!APPLY || (toVerify.length === 0 && toUnverify.length === 0)) return;

  for (const [rows, value] of [
    [toVerify, true],
    [toUnverify, false],
  ] as const) {
    if (rows.length === 0) continue;
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ custom_domain_verified: value })
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (updateError) {
      console.error(`Failed to set custom_domain_verified=${value}: ${updateError.message}`);
      process.exit(1);
    }
    console.log(`Set custom_domain_verified=${value} on ${rows.length} tenant(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
