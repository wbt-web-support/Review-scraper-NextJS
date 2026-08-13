import "server-only";

import { promises as dns } from "node:dns";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import {
  addDomainToVercel,
  getVercelDomainStatus,
  type DnsRecord,
} from "@vrm/lib/vercel/client";
import { cnameTarget, isValidDomain } from "./domain";

/**
 * One place that answers "is this domain ours to serve?", and records the answer.
 *
 * Verification used to be a button. That was the wrong shape: DNS goes live minutes
 * or hours after the client adds the record, long after anyone is looking at the
 * settings page, so a domain that worked perfectly sat on 404 until a human
 * happened to press Verify. Every path that could possibly learn the answer now
 * calls this instead -- saving a domain, opening settings, the hourly sweep, and
 * the first visit to the domain itself.
 *
 * The security model is unchanged: we only set custom_domain_verified once the HOST
 * confirms it is serving the domain for THIS project, which it will only do when the
 * DNS actually resolves here. A tenant can still claim "review.bbc.co.uk"; claiming
 * it just never becomes serving it.
 */

export type DomainSync = {
  /** The host is attached and its own DNS check passes. */
  serving: boolean;
  /** Registered against our project at the host. */
  attached: boolean;
  /** DNS is not (yet) pointing at us. */
  misconfigured: boolean;
  /** What the client must add at their DNS provider. */
  records: DnsRecord[];
  /** True if this call flipped custom_domain_verified on. */
  verifiedNow: boolean;
};

/**
 * When to (re)register the domain with the host.
 *
 *   always        -- somebody asked for this domain by hand: saving it, or pressing
 *                    Check now. Their intent is explicit, so act on it.
 *   when-pointing -- background sweeps. Only register a domain whose DNS already
 *                    resolves to us, which is the difference between a client who
 *                    has done their half of the setup and a typo somebody saved
 *                    once. Without it the sweep would push every abandoned and
 *                    misspelt hostname onto the project, hourly, forever.
 */
export type AttachPolicy = "always" | "when-pointing";

/**
 * Does this hostname resolve to `target`, by CNAME or by flattened A record?
 *
 * Only used when there is no host API to ask. It compares against ONE configured
 * target, which is why it cannot be the primary check on Vercel: Vercel serves both
 * a per-project CNAME and the shared cname.vercel-dns.com, and only one of them can
 * be in NEXT_PUBLIC_CNAME_TARGET.
 */
async function dnsPointsAtTarget(host: string, target: string): Promise<boolean> {
  try {
    const cnames = await dns.resolveCname(host);
    if (cnames.some((v) => v.replace(/\.$/, "").toLowerCase() === target.toLowerCase())) {
      return true;
    }
  } catch {
    // No CNAME record. Fall through to the A-record comparison.
  }

  // Some DNS providers flatten CNAMEs to A records, so compare resolved addresses
  // against the target's instead.
  try {
    const [hostIps, targetIps] = await Promise.all([dns.resolve4(host), dns.resolve4(target)]);
    return hostIps.some((ip) => targetIps.includes(ip));
  } catch {
    return false;
  }
}

/**
 * Check a tenant's domain with the host and persist the verdict.
 *
 * `attach` re-registers the domain with the host when it isn't serving -- see
 * AttachPolicy. Omit it and this is a pure check.
 *
 * Only ever flips the flag ON. A domain that stops resolving is already broken for
 * its visitors, and un-verifying on what might be a momentary API failure would take
 * down working domains for the sake of tidiness. Use scripts/vrm/reverify-domains.ts
 * to clear stale flags deliberately.
 */
export async function syncDomainVerification(
  tenantId: string,
  host: string,
  { verified, attach }: { verified: boolean; attach?: AttachPolicy },
): Promise<DomainSync> {
  const target = cnameTarget();

  if (!isValidDomain(host)) {
    return {
      serving: false,
      attached: false,
      misconfigured: true,
      records: [],
      verifiedNow: false,
    };
  }

  const fromHost = await getVercelDomainStatus(host, target);
  let status: Omit<DomainSync, "verifiedNow">;

  if (fromHost.skipped) {
    // No host API configured (self-hosting, local dev): resolve the DNS ourselves
    // against the one configured target, and show that target as the record to add.
    const serving = await dnsPointsAtTarget(host, target);
    status = {
      serving,
      attached: serving,
      misconfigured: !serving,
      records: [{ type: "CNAME", name: host.split(".")[0], value: target }],
    };
  } else {
    status = fromHost;

    const shouldAttach =
      !status.attached && (attach === "always" || (attach === "when-pointing" && !status.misconfigured));

    if (shouldAttach) {
      // Attaching is idempotent, so just try again -- it covers the domain that was
      // saved before the Vercel token existed, and the one whose registration failed
      // the first time.
      if ((await addDomainToVercel(host)).ok) {
        const recheck = await getVercelDomainStatus(host, target);
        if (!recheck.skipped) status = recheck;
      }
    }
  }

  if (!status.serving || verified) return { ...status, verifiedNow: false };

  // service_role: custom_domain_verified is deliberately not in the tenant's column
  // grants. If it were, this check would be trivially bypassable.
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ custom_domain_verified: true })
    .eq("id", tenantId);

  return { ...status, verifiedNow: !error };
}

/**
 * Last-chance verification, on the first request to the domain itself.
 *
 * A client points their DNS at us and then sends the link to a customer. If the
 * hourly sweep hasn't run yet, that customer would get a 404 on a domain that works.
 * So when /d/[host] finds nothing, we ask the host once before giving up.
 *
 * Costs one indexed lookup for an unclaimed hostname -- no different to what the
 * page already does -- and reaches the Vercel API only for a hostname some tenant
 * has genuinely claimed. Returns true if the domain is now verified and the caller
 * should retry its query.
 */
export async function healDomainOnRequest(host: string): Promise<boolean> {
  const hostname = host.split(":")[0].trim().toLowerCase();
  if (!hostname || !isValidDomain(hostname)) return false;

  const { data: tenant } = await createAdminClient()
    .from("tenants")
    .select("id, custom_domain_verified")
    .ilike("custom_domain", hostname)
    .maybeSingle();

  // Nobody claimed it, or it is claimed and already verified (so the caller's own
  // miss was about something else). Either way there is nothing to heal.
  if (!tenant || tenant.custom_domain_verified) return false;

  const result = await syncDomainVerification(tenant.id as string, hostname, {
    verified: false,
  });
  return result.verifiedNow;
}
