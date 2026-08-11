import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import {
  requireTenant,
  unauthorized,
  badRequest,
  notFound,
  serverError,
  readJsonBody,
  firstZodError,
  NO_STORE,
} from "@vrm/lib/api/auth";
import { getApiReview } from "@vrm/lib/api/reviews";
import { setReviewStatus, deleteTenantReview } from "@/lib/tenantAdmin";

/**
 * One review, by id.
 *
 *   GET    /api/v1/reviews/{id}   read it
 *   PATCH  /api/v1/reviews/{id}   {"status":"approved"}  moderate it
 *   DELETE /api/v1/reviews/{id}   remove it, and its video
 *
 * The write half of the integration API. A client with a CRM or an internal
 * dashboard can now moderate from there instead of logging into ours, which is
 * what "we already have a place our team does this" always turns out to mean.
 *
 * The tenant comes from the key alone, and the id is checked against that tenant
 * before anything is written, so one client can neither read, moderate nor delete
 * another's testimonials by guessing a uuid. An id belonging to someone else is
 * reported as 404, exactly like an id that never existed: a caller probing for
 * other tenants' reviews learns nothing from the difference.
 *
 * NO CORS HEADERS, deliberately, as with the list route. These are secret-key
 * endpoints, and DELETE from a visitor's browser is not a thing to make easy.
 */

const StatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"], {
    error: "status must be one of: pending, approved, rejected.",
  }),
});

/** Both surfaces that list reviews: the tenant's own, and the agency's view of it. */
function revalidateReviewViews(tenantId: string) {
  revalidatePath("/video/dashboard");
  revalidatePath("/video/dashboard/reviews");
  revalidatePath(`/video/admin/tenants/${tenantId}`);
}

const IdSchema = z.uuid({ error: "That is not a valid review id." });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const parsedId = IdSchema.safeParse((await params).id);
  if (!parsedId.success) return badRequest(firstZodError(parsedId.error));

  try {
    const review = await getApiReview(tenant.id, parsedId.data);
    if (!review) return notFound("No such review.");
    return NextResponse.json({ review }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/v1/reviews/[id] failed:", err);
    return serverError("Could not load that review.");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const parsedId = IdSchema.safeParse((await params).id);
  if (!parsedId.success) return badRequest(firstZodError(parsedId.error));

  const { body, error } = await readJsonBody(request);
  if (error) return error;

  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) return badRequest(firstZodError(parsed.error));

  try {
    // Confirm it is theirs before writing. The update is scoped by tenant_id too,
    // so a foreign id would change nothing -- but it would report success, and an
    // API that says "approved" while approving nothing is worse than a 404.
    const existing = await getApiReview(tenant.id, parsedId.data);
    if (!existing) return notFound("No such review.");

    await setReviewStatus(tenant.id, parsedId.data, parsed.data.status);
    revalidateReviewViews(tenant.id);

    const review = await getApiReview(tenant.id, parsedId.data);
    return NextResponse.json({ review }, { headers: NO_STORE });
  } catch (err) {
    console.error("PATCH /api/v1/reviews/[id] failed:", err);
    return serverError("Could not update that review.");
  }
}

/**
 * Permanent, and it takes the video with it.
 *
 * Rejecting is not deleting: a rejected review is hidden but kept, which is what
 * "we're not using this one" should do. Reach for DELETE when the review must not
 * exist -- a customer withdrawing consent, a mistaken recording. There is no undo
 * and no confirmation step here, because the caller is a program: whatever asked
 * for this is responsible for having meant it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const parsedId = IdSchema.safeParse((await params).id);
  if (!parsedId.success) return badRequest(firstZodError(parsedId.error));

  try {
    const existing = await getApiReview(tenant.id, parsedId.data);
    if (!existing) return notFound("No such review.");

    await deleteTenantReview(tenant.id, parsedId.data);
    revalidateReviewViews(tenant.id);

    return NextResponse.json(
      { deleted: true, id: parsedId.data },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("DELETE /api/v1/reviews/[id] failed:", err);
    return serverError("Could not delete that review.");
  }
}
