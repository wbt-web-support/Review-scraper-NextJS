import { createAdminClient } from "@vrm/lib/supabase/admin";
import { titleCaseName } from "@vrm/lib/tenants/display-name";

export interface TenantBrand {
  name: string;
  logoUrl: string | null;
  brandColor: string;
}

/**
 * The tenant that owns a custom domain, for branding the login page served on it.
 *
 * Only a VERIFIED custom domain resolves -- an unverified one isn't serving anyway.
 * Returns null for our own hosts (no custom_domain matches), so the main /login keeps
 * its default ReviewHub look. Read-only, service-role: this runs for an anonymous
 * visitor on the client's domain, before any login.
 */
export async function getTenantBrandingByHost(host: string): Promise<TenantBrand | null> {
  const hostname = host.split(":")[0].trim().toLowerCase();
  if (!hostname) return null;

  const { data } = await createAdminClient()
    .from("tenants")
    .select("name, logo_url, brand_color, custom_domain_verified")
    .ilike("custom_domain", hostname)
    .maybeSingle();

  if (!data || !data.custom_domain_verified) return null;
  return {
    name: titleCaseName(data.name),
    logoUrl: data.logo_url,
    brandColor: data.brand_color || "#4f46e5",
  };
}
