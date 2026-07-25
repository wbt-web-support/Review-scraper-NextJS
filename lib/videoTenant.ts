import type { NextApiRequest } from "next";
import { z } from "zod/v4";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import { provisionTenant } from "@vrm/lib/tenants/provision";
import { suggestPassword } from "@vrm/lib/tenants/password";
import { collectUrl } from "@vrm/lib/widget/collect-url";

/**
 * The link a scraper-side record (a Widget or a BusinessUrl) keeps to its Video
 * Review Manager tenant in Supabase. The tenant itself, its reviews, its login and
 * its settings all live in Postgres; these four fields are the whole bridge.
 */
export interface VideoTenantLink {
  tenantId: string;
  slug: string;
  embedKey: string;
  collectUrl: string;
}

/**
 * The video-review fields, exactly the set the New Tenant dialog collects. Mirrors
 * CreateTenantSchema in vrm/lib/tenants/actions.ts -- kept as its own schema because
 * that one parses a Server Action's FormData and these parse a JSON API body. The
 * FIELDS and messages are what must stay in step; change one, change both.
 *
 * `name` is deliberately absent: every caller already has a business name of its own
 * (the widget's name, the scraped business's name) and passes it in separately, so
 * there is one name, not two that can disagree.
 */
export const videoTenantSchema = z.object({
  contactEmail: z.email({ error: "Enter a valid business email." }).trim(),
  contactPhone: z.string().trim().max(40).optional(),
  rootDomain: z.string().trim().max(255).optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "Brand colour must be a hex value like #8A9A5B." }),
  logoUrl: z.union([z.url(), z.literal("")]).optional(),
  adminPassword: z
    .string()
    .min(8, { error: "The login password must be at least 8 characters." }),
});

export type VideoTenantFields = z.infer<typeof videoTenantSchema>;

/** This app's own origin, for the collection URL baked into the link. */
export function originForRequest(req: NextApiRequest): string {
  const host = req.headers.host ?? "localhost:3000";
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Provisions a Video Review Manager tenant from a scraper-side request.
 *
 * This is the ONE place the scraper (NextAuth) crosses into the video product
 * (Supabase). Both the Create Widget modal and the Add Business dialog reach it, so
 * the two cannot drift. Authorization is the caller's NextAuth session -- there is no
 * Supabase user for RLS to evaluate, which is exactly why it goes through
 * provisionTenant() with the admin client. Every caller MUST have checked the session
 * before calling; this function does not.
 *
 * Returns the tenant and the four-field link to store against the scraper record. On
 * failure it returns a readable message and leaves nothing behind -- provisionTenant()
 * already unwinds its own half-built tenant.
 */
export async function provisionVideoTenant(
  input: VideoTenantFields & { name: string },
  origin: string,
): Promise<
  | { ok: true; tenantId: string; tenantName: string; link: VideoTenantLink }
  | { ok: false; message: string }
> {
  const provisioned = await provisionTenant(
    {
      name: input.name,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone || null,
      rootDomain: input.rootDomain || null,
      brandColor: input.brandColor,
      logoUrl: input.logoUrl || null,
      adminPassword: input.adminPassword,
    },
    createAdminClient(),
  );

  if (!provisioned.ok) return { ok: false, message: provisioned.error };

  const t = provisioned.tenant;
  return {
    ok: true,
    tenantId: t.id,
    tenantName: t.name,
    link: {
      tenantId: t.id,
      slug: t.slug,
      embedKey: t.embed_key,
      collectUrl: collectUrl({
        origin,
        slug: t.slug,
        customDomain: t.custom_domain,
        // Freshly created, so never verified yet. The widget feed recomputes this
        // from live data; the stored copy is for the agency's own UI.
        customDomainVerified: false,
      }),
    },
  };
}

/**
 * Pushes edited business details onto its Video Review Manager tenant, so the
 * collection page and widget reflect them.
 *
 * Only the plain display columns are touched: name, brand colour, logo, and the
 * CONTACT email/phone. The login email (auth.users) is deliberately NOT changed here
 * -- rotating a client's sign-in is a heavier, riskier operation and belongs on the
 * tenant's own admin page, not in a details edit. Undefined fields are left as they
 * are. Best-effort: a failure here must not fail the whole edit, so callers log
 * rather than abort (the Mongo record is the source of truth the operator sees).
 */
export async function updateTenantDetails(
  tenantId: string,
  fields: {
    name?: string;
    brandColor?: string;
    logoUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: Record<string, string | null> = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.brandColor !== undefined) patch.brand_color = fields.brandColor;
  if (fields.logoUrl !== undefined) patch.logo_url = fields.logoUrl || null;
  if (fields.contactEmail !== undefined) patch.contact_email = fields.contactEmail || null;
  if (fields.contactPhone !== undefined) patch.contact_phone = fields.contactPhone || null;

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await createAdminClient().from("tenants").update(patch).eq("id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Sets the sign-in password for a tenant's owner login and returns what it is now.
 *
 * The owner login is the `tenant_admin` profile for this tenant; its `id` is the
 * Supabase auth user. Pass a `password` to set a specific one, or omit it to generate
 * a fresh spoken-word password. Either way the new value is applied with the admin API
 * and handed back so the caller can store and show it. Authorization is the caller's
 * (the API route checks the NextAuth session owns the business first).
 */
export async function resetTenantLoginPassword(
  tenantId: string,
  password?: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("role", "tenant_admin")
    .limit(1)
    .maybeSingle();

  if (profileErr) return { ok: false, error: profileErr.message };
  if (!profile?.id) return { ok: false, error: "No login exists for this business yet." };

  const next = password ?? suggestPassword();
  const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id as string, { password: next });
  if (updateErr) return { ok: false, error: updateErr.message };

  return { ok: true, password: next };
}
