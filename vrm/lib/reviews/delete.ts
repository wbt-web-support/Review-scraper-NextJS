"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { createClient } from "@vrm/lib/supabase/server";
import { resolveWritableTenantId } from "@vrm/lib/auth/tenant-scope";
import { deleteStoredVideo } from "@vrm/lib/video/provider";

export type DeleteReviewState = { error: string } | undefined;

const Schema = z.object({
  reviewId: z.uuid(),
});

/**
 * Permanently delete a review, and the video with it.
 *
 * Available to BOTH the tenant (on their own dashboard) and the agency (on
 * /admin/tenants/[id]), because it is the same act against the same row: a customer
 * who asks for their testimonial to be taken down should not have to wait for the
 * agency to be free, and the agency should not have to impersonate a client to
 * honour a takedown.
 *
 * Rejecting is not deleting. A rejected review is hidden but kept, which is the
 * right default for "we're not using this one". Deleting is for "this must not
 * exist": a customer withdrawing consent, a mistaken recording, a malicious
 * submission. So it is irreversible, it removes the VIDEO as well as the row, and
 * it asks first.
 *
 * Authorization is three-deep, as with moderation. resolveWritableTenantId honours
 * a form-supplied tenantId only for a verified super admin; the .eq('tenant_id')
 * scopes the delete; and the reviews_delete RLS policy (has_tenant_access) refuses
 * a cross-tenant delete underneath both. Deleting another business's testimonials
 * is exactly the sort of thing this has to make impossible.
 */
export async function deleteReview(
  _prev: DeleteReviewState,
  formData: FormData,
): Promise<DeleteReviewState> {
  const tenantId = await resolveWritableTenantId(formData.get("tenantId"));

  const parsed = Schema.safeParse({ reviewId: formData.get("reviewId") });
  if (!parsed.success) return { error: "Something went wrong. Try again." };

  const supabase = await createClient();

  // Read the video's location BEFORE the row goes: once it is deleted, nothing
  // remembers where the bytes were, and they are unfindable forever after.
  //
  // Read as the caller, not with service_role, so RLS is what decides whether this
  // review is theirs to see at all.
  const { data: review, error: readError } = await supabase
    .from("reviews")
    .select("id, video_guid")
    .eq("id", parsed.data.reviewId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!review) return { error: "That review no longer exists." };

  // Video first, then the row. The other order is tempting and wrong: if the row
  // goes first and the video deletion then fails, the video is orphaned -- still
  // stored, still billed, still holding a customer's face, and now with nothing left
  // that knows it exists. A failed row delete just leaves a visible review whose
  // video is gone, which the next attempt cleans up.
  if (review.video_guid) {
    await deleteStoredVideo(review.video_guid); // never throws; logs on failure
  }

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", review.id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  // Both surfaces that list reviews: the tenant's own, and the agency's view of it.
  revalidatePath("/video/dashboard");
  revalidatePath("/video/dashboard/reviews");
  revalidatePath(`/video/admin/tenants/${tenantId}`);

  return undefined;
}
