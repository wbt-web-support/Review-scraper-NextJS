import "server-only";

import { createClient } from "@vrm/lib/supabase/server";
import { verifySession } from "@vrm/lib/auth/dal";
import { getVercelDomainStatus, type DnsRecord } from "@vrm/lib/vercel/client";
import { cnameTarget } from "@vrm/lib/domains/domain";

export type TenantSettingsData = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    embed_key: string;
    /** Secret. Only ever rendered on the agency's tenant page. */
    api_key: string;
    logo_url: string | null;
    brand_color: string;
    contact_email: string | null;
    contact_phone: string | null;
    custom_domain: string | null;
    custom_domain_verified: boolean;
    review_open_mode: "dialog" | "page";
    max_video_seconds: number;
  };
  collection: {
    prompt_questions: string[];
    welcome_text: string;
    thank_you_text: string;
  };
  widget: {
    layout: "grid" | "carousel" | "single";
    autoplay: boolean;
  };
  /**
   * The DNS records the client must actually add, straight from the host.
   *
   * Not hardcoded: Vercel issues a per-project CNAME target now, so a fixed value
   * goes stale silently and the client enters a record that never verifies.
   */
  dns: {
    records: DnsRecord[];
    /** The host is attached AND resolving. "Live" means this, not just "DNS is right". */
    serving: boolean;
  };
};

/**
 * Everything the settings UI needs, for a named tenant.
 *
 * Authorization is RLS, not a role check here. The query runs as the caller: a
 * tenant_admin's tenants_select policy only matches their own row, so asking for
 * someone else's tenant simply returns null. A super_admin's matches any.
 *
 * That is why the same function serves both /dashboard/settings and
 * /admin/tenants/[id] -- the database decides who may see what, and there is no
 * second implementation to keep in sync.
 */
export async function getTenantSettings(
  tenantId: string,
): Promise<TenantSettingsData | null> {
  await verifySession();
  const supabase = await createClient();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select(
      "id, name, slug, subdomain, embed_key, api_key, logo_url, brand_color, contact_email, contact_phone, custom_domain, custom_domain_verified, review_open_mode, max_video_seconds",
    )
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!tenant) return null; // not theirs, or does not exist -- same answer either way

  const [{ data: collection }, { data: widget }] = await Promise.all([
    supabase
      .from("collection_settings")
      .select("prompt_questions, welcome_text, thank_you_text")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("widget_settings")
      .select("layout, autoplay")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  const rawQuestions = collection?.prompt_questions;

  // Ask the host what DNS it wants, and whether it is actually serving the domain.
  const t = tenant as TenantSettingsData["tenant"];
  let dns: TenantSettingsData["dns"] = { records: [], serving: t.custom_domain_verified };

  if (t.custom_domain) {
    const status = await getVercelDomainStatus(t.custom_domain, cnameTarget());
    if (status.skipped) {
      // No host API configured: fall back to the statically configured target.
      dns = {
        records: [
          { type: "CNAME", name: t.custom_domain.split(".")[0], value: cnameTarget() },
        ],
        serving: t.custom_domain_verified,
      };
    } else {
      dns = { records: status.records, serving: status.serving };
    }
  }

  return {
    tenant: t,
    collection: {
      prompt_questions: Array.isArray(rawQuestions)
        ? rawQuestions.filter((q): q is string => typeof q === "string")
        : [],
      welcome_text: collection?.welcome_text ?? "",
      thank_you_text: collection?.thank_you_text ?? "",
    },
    widget: {
      layout: (widget?.layout as TenantSettingsData["widget"]["layout"]) ?? "grid",
      autoplay: widget?.autoplay ?? false,
    },
    dns,
  };
}
