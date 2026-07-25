"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { assertRole, IMPERSONATION_COOKIE } from "@vrm/lib/auth/dal";
import { createTenant } from "./queries";

export type FormState = { error: string } | { success: string } | undefined;

const CreateTenantSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a business name." }).max(120),
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

export async function createTenantAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Server Actions must authorize themselves -- the proxy does not do it for them.
  await assertRole("super_admin");

  const parsed = CreateTenantSchema.safeParse({
    name: formData.get("name"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") ?? "",
    rootDomain: formData.get("rootDomain") ?? "",
    brandColor: formData.get("brandColor"),
    logoUrl: formData.get("logoUrl") ?? "",
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error).split("\n")[0].replace(/^✖\s*/, "") };
  }

  // Creates the tenant, its default settings, AND the owner's login in one go.
  const result = await createTenant({
    name: parsed.data.name,
    contactEmail: parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone || null,
    rootDomain: parsed.data.rootDomain || null,
    brandColor: parsed.data.brandColor,
    logoUrl: parsed.data.logoUrl || null,
    adminPassword: parsed.data.adminPassword,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/video/admin");
  redirect(`/video/admin/tenants/${result.tenant.id}`);
}

/**
 * Start viewing a tenant's dashboard as a super admin.
 *
 * The cookie is unsigned on purpose: getTenantContext() only reads it after the
 * verified JWT confirms the caller is a super_admin, so forging it as anyone else
 * achieves nothing. httpOnly keeps it out of reach of any script on the page.
 */
export async function impersonateTenant(formData: FormData) {
  await assertRole("super_admin");

  const tenantId = z.uuid().parse(formData.get("tenantId"));

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // an hour; impersonation should not outlive a working session
  });

  redirect("/video/dashboard");
}

export async function stopImpersonating() {
  // No role assertion: clearing your own view-as cookie is always safe, and a
  // tenant_admin who somehow has one should be able to shed it.
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect("/video/admin");
}
