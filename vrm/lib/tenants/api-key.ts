"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { requireRole } from "@vrm/lib/auth/dal";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import type { ActionState } from "@vrm/lib/reviews/actions";

/**
 * Rotate a tenant's integration API key.
 *
 * Agency-only, and on service_role for a reason: api_key is absent from the
 * `authenticated` UPDATE column grants, so Postgres would refuse this write to a
 * logged-in tenant even if the code here forgot to check. requireRole is the first
 * gate; the column grant is the one that holds when the first is wrong.
 *
 * Rotating is destructive in a way that is easy to underrate: every integration
 * the client has already built starts 401ing the moment it lands, with no warning
 * and no grace period. The UI says so before it lets anyone press the button.
 */
export async function rotateApiKey(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = z.uuid().safeParse(formData.get("tenantId"));
  if (!parsed.success) return { error: "Unknown business." };
  const tenantId = parsed.data;

  // 24 bytes of CSPRNG. The vrm_ prefix makes a leaked key recognisable on sight,
  // in a log line or a secret scanner, before someone gets round to using it.
  const key = `vrm_${randomBytes(24).toString("hex")}`;

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({ api_key: key })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  revalidatePath(`/video/admin/tenants/${tenantId}`);
  return { success: "New key generated. The old one stopped working immediately." };
}
