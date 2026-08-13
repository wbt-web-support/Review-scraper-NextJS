"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { createClient } from "@vrm/lib/supabase/server";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import { resolveWritableTenantId } from "@vrm/lib/auth/tenant-scope";
import {
  addDomainToVercel,
  removeDomainFromVercel,
  isVercelConfigured,
} from "@vrm/lib/vercel/client";
import { syncDomainVerification } from "./verify";
import { normalizeRootDomain, reviewHostFor, isValidDomain } from "./domain";

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

  // The DNS is often already in place -- an agency setting a client up will have
  // added the record before touching this form. Check right now rather than making
  // them wait for the sweep to notice.
  const synced = await syncDomainVerification(tenantId, host, { verified: false });

  revalidateSettings(tenantId);

  if (synced.verifiedNow) return { success: `${host} is live.` };

  return {
    success: isVercelConfigured()
      ? "Saved and registered with the host. Add the DNS record below and it goes live on its own, usually within minutes."
      : "Saved. Add the DNS record below and it goes live on its own, usually within minutes.",
  };
}

/**
 * Re-check a domain now, instead of waiting for the sweep.
 *
 * Verification is automatic: syncDomainVerification runs on save, on every settings
 * page load, on the hourly sweep, and on the first request to the domain itself. So
 * this button is no longer how a domain goes live -- it is the impatient path, for
 * the client who has just added the record and wants an answer this second.
 *
 * The security model is unchanged and lives in syncDomainVerification: we only serve
 * a custom host once the host confirms its DNS resolves to this project. Without
 * that, anyone could type "review.bbc.co.uk" and we would serve their content on the
 * BBC's domain.
 */
export async function verifyCustomDomain(forTenantId?: string): Promise<DomainState> {
  const tenantId = await resolveWritableTenantId(forTenantId);

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("custom_domain, custom_domain_verified")
    .eq("id", tenantId)
    .maybeSingle();

  const host = tenant?.custom_domain;
  if (!host || !isValidDomain(host)) {
    return { error: "Add a domain first." };
  }

  const result = await syncDomainVerification(tenantId, host, {
    verified: Boolean(tenant?.custom_domain_verified),
    attach: "always",
  });

  if (!result.serving) {
    return {
      error: result.misconfigured
        ? `${host} isn't pointing at us yet. Add the record below — we'll keep checking, and it goes live on its own once DNS updates.`
        : `The host isn't serving ${host} yet. It usually takes a minute to issue the certificate — it will go live on its own shortly.`,
    };
  }

  revalidateSettings(tenantId);
  return { success: `${host} is live.` };
}
