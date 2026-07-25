"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { assertRole } from "@vrm/lib/auth/dal";
import { createAdminClient } from "@vrm/lib/supabase/admin";

export type OpenModeState = { error: string } | { success: string } | undefined;

const Schema = z.object({
  tenantId: z.uuid(),
  mode: z.enum(["dialog", "page"]),
});

/**
 * AGENCY-ONLY. How the widget's "Leave a review" button behaves.
 *
 * assertRole('super_admin') is the gate, and the database backs it up:
 * review_open_mode is not in the `authenticated` column grants, so even a bug here
 * could not let a tenant_admin change it -- Postgres would refuse the UPDATE. Hence
 * service_role, which is the only way to write the column at all.
 */
export async function setReviewOpenMode(
  _prev: OpenModeState,
  formData: FormData,
): Promise<OpenModeState> {
  await assertRole("super_admin");

  const parsed = Schema.safeParse({
    tenantId: formData.get("tenantId"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return { error: "Pick an option." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({ review_open_mode: parsed.data.mode })
    .eq("id", parsed.data.tenantId);

  if (error) return { error: error.message };

  revalidatePath(`/video/admin/tenants/${parsed.data.tenantId}`);
  revalidatePath("/video/dashboard/settings");

  return {
    success:
      parsed.data.mode === "dialog"
        ? "Saved. Reviews now open in a dialog, without leaving the client's site."
        : "Saved. Reviews now open as a full page in a new tab.",
  };
}
