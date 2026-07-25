"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { assertRole } from "@vrm/lib/auth/dal";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import {
  MIN_VIDEO_SECONDS,
  MAX_VIDEO_SECONDS,
  formatVideoLength,
} from "@vrm/lib/video/limits";

export type VideoLimitState = { error: string } | { success: string } | undefined;

const Schema = z.object({
  tenantId: z.uuid(),
  maxVideoSeconds: z.coerce
    .number()
    .int()
    .min(MIN_VIDEO_SECONDS)
    .max(MAX_VIDEO_SECONDS),
});

/**
 * AGENCY-ONLY. How long a review video may be, for one tenant.
 *
 * assertRole('super_admin') is the gate, and the database backs it up:
 * max_video_seconds is not in the `authenticated` column grants, so even a bug
 * here could not let a tenant_admin raise their own ceiling -- Postgres would
 * refuse the UPDATE. Hence service_role, the only way to write the column at all.
 *
 * Existing reviews are untouched. The limit applies to what gets recorded next,
 * and retroactively rejecting testimonials a client already approved would be a
 * genuinely astonishing thing for a settings change to do.
 */
export async function setMaxVideoSeconds(
  _prev: VideoLimitState,
  formData: FormData,
): Promise<VideoLimitState> {
  await assertRole("super_admin");

  const parsed = Schema.safeParse({
    tenantId: formData.get("tenantId"),
    maxVideoSeconds: formData.get("maxVideoSeconds"),
  });
  if (!parsed.success) return { error: "Pick a length." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({ max_video_seconds: parsed.data.maxVideoSeconds })
    .eq("id", parsed.data.tenantId);

  if (error) return { error: error.message };

  revalidatePath(`/video/admin/tenants/${parsed.data.tenantId}`);
  revalidatePath("/video/dashboard/settings");

  return {
    success: `Saved. Videos are now capped at ${formatVideoLength(parsed.data.maxVideoSeconds)}.`,
  };
}
