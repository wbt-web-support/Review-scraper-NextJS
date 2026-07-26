import "server-only";

import { createAdminClient } from "@vrm/lib/supabase/admin";
import { titleCaseName } from "@vrm/lib/tenants/display-name";
import { prepareVideoUpload, type VideoUpload } from "@vrm/lib/video/provider";
import { DEFAULT_MAX_VIDEO_SECONDS } from "@vrm/lib/video/limits";

/**
 * The public collection path.
 *
 * Everything here runs with service_role, which BYPASSES RLS. So the database is
 * NOT the safety net on these functions -- this module is. Two rules follow:
 *
 *   1. The caller never supplies a tenant_id. It is always resolved server-side
 *      from the public slug. A tenant_id in the request body is ignored.
 *   2. status is hard-coded to 'pending' and consent is required. The DB CHECK
 *      constraints back both up, but do not rely on that -- state it here too.
 */

export type CollectionPage = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    brandColor: string;
  };
  promptQuestions: string[];
  welcomeText: string;
  /** Optional subtitle shown under the welcome title. */
  description: string;
  thankYouText: string;
  /** The recorder stops here. Public, because the reviewer's browser enforces it. */
  maxVideoSeconds: number;
};

/**
 * Public: a tenant's collection page by slug.
 *
 * Returns a hand-picked shape, never `select *`. The tenant row also holds
 * embed_key, plan, and custom_domain -- none of which belong on a page served to
 * an anonymous member of the public.
 */
export async function getCollectionPage(slug: string): Promise<CollectionPage | null> {
  const admin = createAdminClient();

  const { data: tenant, error } = await admin
    .from("tenants")
    .select("id, name, slug, logo_url, brand_color, max_video_seconds")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!tenant) return null;

  const { data: settings } = await admin
    .from("collection_settings")
    .select("prompt_questions, welcome_text, description, thank_you_text")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const rawQuestions = settings?.prompt_questions;
  const promptQuestions = Array.isArray(rawQuestions)
    ? rawQuestions.filter((q): q is string => typeof q === "string")
    : [];

  return {
    tenant: {
      id: tenant.id,
      // Capitalised here, at the one place this page's data is assembled, so the
      // header and the consent copy in collect-form both get it. This is the page a
      // client's own customer lands on. Display only: tenants.name is not modified.
      name: titleCaseName(tenant.name),
      slug: tenant.slug,
      logoUrl: tenant.logo_url,
      brandColor: tenant.brand_color,
    },
    promptQuestions,
    welcomeText: settings?.welcome_text ?? "We would love to hear from you.",
    description: settings?.description ?? "",
    thankYouText: settings?.thank_you_text ?? "Thank you for your review!",
    maxVideoSeconds: tenant.max_video_seconds ?? DEFAULT_MAX_VIDEO_SECONDS,
  };
}

export type ReviewerInput = {
  reviewerName: string;
  reviewerEmail?: string | null;
  rating: number;
  consentGiven: boolean;
};

async function resolveTenant(slug: string): Promise<{ id: string; name: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
}

/**
 * The title Bunny stores against the video.
 *
 * Bunny knows a video only by its GUID, so without a readable title its dashboard
 * is an unsearchable wall of thumbnails. Naming it after the business, then the
 * customer, then their email makes a video identifiable from Bunny's side alone,
 * which is what you want when reconciling a billing spike or chasing a bad encode.
 *
 * The email is PII sitting in a third party. Our own DB is still the system of
 * record; this is a label for humans, so a missing email is not worth failing over.
 */
function videoTitle(tenantName: string, input: ReviewerInput): string {
  return [tenantName, input.reviewerName, input.reviewerEmail || "no email"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

export async function submitTextReview(
  slug: string,
  input: ReviewerInput & { textReview: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  // GDPR. Also a DB CHECK, but refuse here so we never even attempt the write.
  if (!input.consentGiven) return { ok: false, error: "Consent is required." };

  const tenant = await resolveTenant(slug);
  if (!tenant) return { ok: false, error: "This collection page does not exist." };

  const admin = createAdminClient();
  const { error } = await admin.from("reviews").insert({
    tenant_id: tenant.id, // from the slug, never from the client
    reviewer_name: input.reviewerName,
    reviewer_email: input.reviewerEmail || null,
    rating: input.rating,
    text_review: input.textReview,
    type: "text",
    status: "pending", // every review is moderated. Not negotiable, not client-settable.
    consent_given: true,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Starts a video review: reserves the video with whichever provider is configured
 * (Bunny, else Supabase Storage), writes the pending review row, and returns an
 * upload credential scoped to that one video.
 *
 * The row is written BEFORE the bytes arrive. That is deliberate: an abandoned
 * upload then leaves a pending review with no playable video -- visible to the
 * tenant admin, harmless, rejectable. The alternative (write the row only once the
 * upload finishes) turns a successful upload with a failed write into an orphaned
 * video that nobody knows exists.
 */
export async function startVideoReview(
  slug: string,
  input: ReviewerInput & { contentType?: string },
): Promise<
  { ok: true; reviewId: string; upload: VideoUpload } | { ok: false; error: string }
> {
  if (!input.consentGiven) return { ok: false, error: "Consent is required." };

  const tenant = await resolveTenant(slug);
  if (!tenant) return { ok: false, error: "This collection page does not exist." };

  const video = await prepareVideoUpload(
    tenant.id,
    videoTitle(tenant.name, input),
    input.contentType ?? "video/webm",
  );

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reviews")
    .insert({
      tenant_id: tenant.id,
      reviewer_name: input.reviewerName,
      reviewer_email: input.reviewerEmail || null,
      rating: input.rating,
      video_guid: video.videoGuid,
      // Bunny: null until its encode webhook fires. Supabase: known already, since
      // the public URL is derived from the path and there is no processing step.
      video_url: video.videoUrl,
      type: "video",
      status: "pending",
      consent_given: true,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  return { ok: true, reviewId: data.id, upload: video.upload };
}
