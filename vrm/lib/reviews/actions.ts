"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { createClient } from "@vrm/lib/supabase/server";
import { resolveWritableTenantId } from "@vrm/lib/auth/tenant-scope";

export type ActionState = { error: string } | { success: string } | undefined;

const StatusSchema = z.enum(["pending", "approved", "rejected"]);

function firstError(error: z.ZodError): string {
  return z.prettifyError(error).split("\n")[0].replace(/^✖\s*/, "");
}

/** Both settings surfaces revalidate: the tenant's own, and the admin's view of it. */
function revalidateSettings(tenantId: string) {
  revalidatePath("/video/dashboard/settings");
  revalidatePath(`/video/admin/tenants/${tenantId}`);
}

/**
 * Approve or reject a review.
 *
 * resolveWritableTenantId, not getTenantContext: the agency moderates from
 * /admin/tenants/[id] without impersonating, so the tenant is named in the form.
 * That form value is honoured ONLY for a verified super admin. A tenant admin who
 * forges the field gets their own tenant back, the .eq('tenant_id') then scopes
 * the write, and RLS refuses a cross-tenant update underneath both. Three layers,
 * because a cross-tenant write here would let one business moderate another's
 * testimonials.
 */
export async function setReviewStatus(formData: FormData): Promise<void> {
  const tenantId = await resolveWritableTenantId(formData.get("tenantId"));

  const reviewId = z.uuid().parse(formData.get("reviewId"));
  const status = StatusSchema.parse(formData.get("status"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ status })
    .eq("id", reviewId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);

  // Both surfaces that show reviews: the tenant's own list, and the agency's view
  // of that tenant.
  revalidatePath("/video/dashboard");
  revalidatePath(`/video/admin/tenants/${tenantId}`);
}

const SettingsSchema = z.object({
  welcomeText: z.string().trim().min(1).max(300),
  thankYouText: z.string().trim().min(1).max(300),
  // One question per line. Blank lines are dropped, not saved as empty prompts.
  promptQuestions: z.string().max(2000),
});

export async function updateCollectionSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Honours a tenantId only for super admins. See resolveWritableTenantId.
  const tenantId = await resolveWritableTenantId(formData.get("tenantId"));

  const parsed = SettingsSchema.safeParse({
    welcomeText: formData.get("welcomeText"),
    thankYouText: formData.get("thankYouText"),
    promptQuestions: formData.get("promptQuestions") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const questions = parsed.data.promptQuestions
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 10);

  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_settings")
    .update({
      welcome_text: parsed.data.welcomeText,
      thank_you_text: parsed.data.thankYouText,
      prompt_questions: questions,
    })
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  revalidateSettings(tenantId);
  return { success: "Saved." };
}

const WidgetSchema = z.object({
  layout: z.enum(["grid", "carousel", "single"]),
  autoplay: z.coerce.boolean(),
});

export async function updateWidgetSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const tenantId = await resolveWritableTenantId(formData.get("tenantId"));

  const parsed = WidgetSchema.safeParse({
    layout: formData.get("layout"),
    // An unchecked checkbox sends nothing at all, so absence means false.
    autoplay: formData.get("autoplay") === "on",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("widget_settings")
    .update({ layout: parsed.data.layout, autoplay: parsed.data.autoplay })
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  revalidateSettings(tenantId);
  return { success: "Saved. The embedded widget updates within a minute." };
}

const BrandingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Use a hex colour like #8A9A5B." }),
  logoUrl: z.union([z.url(), z.literal("")]).optional(),
  contactEmail: z.union([z.email(), z.literal("")]).optional(),
  contactPhone: z.string().trim().max(40).optional(),
});

/**
 * Branding and contact details.
 *
 * Exactly the columns that column-level grants allow `authenticated` to UPDATE.
 * plan, slug, subdomain, embed_key and custom_domain_verified are deliberately not
 * writable here -- and Postgres would refuse them even if this code tried.
 */
export async function updateBranding(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const tenantId = await resolveWritableTenantId(formData.get("tenantId"));

  const parsed = BrandingSchema.safeParse({
    name: formData.get("name"),
    brandColor: formData.get("brandColor"),
    logoUrl: formData.get("logoUrl") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      name: parsed.data.name,
      brand_color: parsed.data.brandColor,
      logo_url: parsed.data.logoUrl || null,
      contact_email: parsed.data.contactEmail || null,
      contact_phone: parsed.data.contactPhone || null,
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  revalidateSettings(tenantId);
  return { success: "Saved." };
}
