"use server";

import { promises as dns } from "node:dns";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { createClient } from "@vrm/lib/supabase/server";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import { resolveWritableTenantId } from "@vrm/lib/auth/tenant-scope";
import {
  addDomainToVercel,
  getVercelDomainStatus,
  removeDomainFromVercel,
  isVercelConfigured,
} from "@vrm/lib/vercel/client";
import {
  normalizeRootDomain,
  reviewHostFor,
  cnameTarget,
  isValidDomain,
} from "./domain";

export type DomainState = { error: string } | { success: string } | undefined;

/** Both settings surfaces: the tenant's own, and the admin's view of it. */
function revalidateSettings(tenantId: string) {
  revalidatePath("/video/dashboard/settings");
  revalidatePath(`/video/admin/tenants/${tenantId}`);
}

/**
 * Claim a custom domain.
 *
 * Claiming is NOT verifying. This only records the hostname; the domain serves
 * nothing until verifyCustomDomain() confirms the tenant actually controls it via
 * DNS. custom_domain_verified is deliberately absent from the tenant's column
 * grants, so they cannot shortcut that step.
 */
export async function saveCustomDomain(
  _prev: DomainState,
  formData: FormData,
): Promise<DomainState> {
  // Honours a tenantId only for super admins. See resolveWritableTenantId.
  const tenantId = await resolveWritableTenantId(formData.get("tenantId"));

  const raw = z.string().max(255).safeParse(formData.get("rootDomain"));
  if (!raw.success) return { error: "Enter a domain." };

  const supabase = await createClient();

  // Empty input clears the domain.
  if (!raw.data.trim()) {
    // Detach from the host first, or it squats on the project and blocks anyone
    // else from ever claiming it.
    const { data: existing } = await supabase
      .from("tenants")
      .select("custom_domain")
      .eq("id", tenantId)
      .maybeSingle();
    if (existing?.custom_domain) await removeDomainFromVercel(existing.custom_domain);

    const { error } = await supabase
      .from("tenants")
      .update({ custom_domain: null })
      .eq("id", tenantId);
    if (error) return { error: error.message };

    // Clearing must also clear the verified flag, which the tenant cannot write.
    await createAdminClient()
      .from("tenants")
      .update({ custom_domain_verified: false })
      .eq("id", tenantId);

    revalidateSettings(tenantId);
    return { success: "Custom domain removed." };
  }

  const root = normalizeRootDomain(raw.data);
  if (!root) {
    return {
      error: "That doesn't look like a domain. Try something like njdesignpark.com",
    };
  }

  const host = reviewHostFor(root);

  const { error } = await supabase
    .from("tenants")
    .update({ custom_domain: host })
    .eq("id", tenantId);

  if (error) {
    // 23505 = unique_violation on tenants_custom_domain_key.
    if (error.code === "23505") {
      return { error: "That domain is already connected to another account." };
    }
    return { error: error.message };
  }

  // A changed domain is an unverified domain.
  await createAdminClient()
    .from("tenants")
    .update({ custom_domain_verified: false })
    .eq("id", tenantId);

  // Register it with Vercel. DNS alone is not enough: Vercel refuses to serve --
  // or even issue a TLS certificate for -- a domain it has not been told about, so
  // without this the domain drops every connection while the DNS looks perfect.
  const attached = await addDomainToVercel(host);
  if (!attached.ok) {
    revalidateSettings(tenantId);
    // The domain is saved; only the hosting registration failed. Say which.
    return { error: attached.error };
  }

  revalidateSettings(tenantId);
  return {
    success: isVercelConfigured()
      ? "Saved and registered with the host. Add the DNS record below, then verify."
      : "Saved. Add the DNS record below, then verify.",
  };
}

/**
 * Verify the tenant actually controls the domain, by resolving its DNS.
 *
 * This is the entire security model for custom domains. Without it, anyone could
 * type "review.bbc.co.uk" and we would happily serve their content on the BBC's
 * domain. We only serve a custom host once its DNS demonstrably points at us.
 */
export async function verifyCustomDomain(forTenantId?: string): Promise<DomainState> {
  const tenantId = await resolveWritableTenantId(forTenantId);

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("custom_domain")
    .eq("id", tenantId)
    .maybeSingle();

  const host = tenant?.custom_domain;
  if (!host || !isValidDomain(host)) {
    return { error: "Add a domain first." };
  }

  const target = cnameTarget();
  let pointsAtUs = false;

  try {
    const cnames = await dns.resolveCname(host);
    pointsAtUs = cnames.some(
      (value) => value.replace(/\.$/, "").toLowerCase() === target.toLowerCase(),
    );
  } catch {
    // No CNAME record. Some DNS providers flatten CNAMEs to A records, so compare
    // resolved addresses against the target's instead.
    try {
      const [hostIps, targetIps] = await Promise.all([
        dns.resolve4(host),
        dns.resolve4(target),
      ]);
      pointsAtUs = hostIps.some((ip) => targetIps.includes(ip));
    } catch {
      pointsAtUs = false;
    }
  }

  if (!pointsAtUs) {
    return {
      error: `${host} isn't pointing at us yet. Add the CNAME below and try again — DNS can take up to an hour.`,
    };
  }

  // DNS pointing here is only half the answer. The other half is whether the HOST
  // will actually serve it -- and only the host can answer that. Skipping this was
  // the bug that let the app report "Live" for a domain that reset every
  // connection, because Vercel had no certificate for a domain it didn't know about.
  const status = await getVercelDomainStatus(host, target);

  if (!status.skipped && !status.serving) {
    // Attaching is idempotent, so just try again -- it covers the case where the
    // domain was added before the Vercel token existed.
    const attached = await addDomainToVercel(host);
    if (!attached.ok) return { error: attached.error };

    const recheck = await getVercelDomainStatus(host, target);
    if (!recheck.skipped && !recheck.serving) {
      return {
        error: `DNS is correct, but the host isn't serving ${host} yet. It usually takes a minute to issue the certificate — try again shortly.`,
      };
    }
  }

  // service_role: custom_domain_verified is not in the tenant's column grants, by
  // design. If it were, this check would be trivially bypassable.
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ custom_domain_verified: true })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  revalidateSettings(tenantId);
  return { success: `${host} is live.` };
}
