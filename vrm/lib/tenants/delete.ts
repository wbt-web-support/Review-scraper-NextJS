"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { assertRole } from "@vrm/lib/auth/dal";
import { purgeTenant, tenantNameForConfirm } from "./purge";

export type DeleteState = { error: string } | undefined;

const Schema = z.object({
  tenantId: z.uuid(),
  /** The typed-in tenant name. Must match exactly. */
  confirmName: z.string(),
});

/**
 * Permanently delete a tenant. AGENCY-ONLY, and irreversible.
 *
 * This is the video app's authorized entry point: it checks the role, makes the
 * operator type the business name, and then hands off to purgeTenant() -- which is
 * where the actual cleanup lives, because the scraper's widget list deletes tenants
 * too and the video/domain/login teardown must not exist in two places.
 */
export async function deleteTenant(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await assertRole("super_admin");

  const parsed = Schema.safeParse({
    tenantId: formData.get("tenantId"),
    confirmName: formData.get("confirmName"),
  });
  if (!parsed.success) return { error: "Something went wrong. Try again." };

  const name = await tenantNameForConfirm(parsed.data.tenantId);
  if (!name) return { error: "That business no longer exists." };

  // Typing the name is the point of the confirmation: a misclick cannot destroy a
  // client's testimonials, but a deliberate act can.
  if (parsed.data.confirmName.trim() !== name.trim()) {
    return { error: `Type "${name}" exactly to confirm.` };
  }

  const result = await purgeTenant(parsed.data.tenantId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/video/admin");
  redirect("/video/admin");
}
