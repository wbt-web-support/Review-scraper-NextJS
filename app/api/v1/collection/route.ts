import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  requireTenant,
  unauthorized,
  badRequest,
  serverError,
  readJsonBody,
  firstZodError,
  NO_STORE,
} from "@vrm/lib/api/auth";
import {
  getApiSettings,
  applyApiSettings,
  resetApiCollection,
  COLLECTION_DEFAULTS,
} from "@vrm/lib/api/settings";
import {
  CollectionPatchSchema,
  CollectionPutSchema,
  requireSomeKey,
} from "@vrm/lib/api/schemas";

/**
 * The collection page: the wording a customer sees when they land to leave a review.
 *
 *   GET    /api/v1/collection   read it
 *   PUT    /api/v1/collection   replace it whole
 *   PATCH  /api/v1/collection   change some of it
 *   DELETE /api/v1/collection   reset to the default wording
 *
 * The same fields are reachable through /api/v1/settings alongside branding and
 * widget. This route exists because a caller editing only the collection page
 * should not have to nest it under a settings envelope, and because the settings
 * route has no honest meaning for PUT or DELETE across three sections at once.
 *
 * PUT and PATCH differ the way they should: PUT is a replacement, so `description`
 * and `prompt_questions` left out are CLEARED. PATCH leaves anything unsent alone.
 * If in doubt, use PATCH.
 *
 * DELETE resets rather than removes. There is no such thing as a tenant without a
 * collection page: they always have a /c/<slug> URL and it always has to render
 * something, so the only sensible reading of "delete" is "put it back to default".
 */

const PatchSchema = requireSomeKey(
  CollectionPatchSchema,
  "welcome_text, description, thank_you_text, prompt_questions",
);

export async function GET(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  try {
    const settings = await getApiSettings(tenant.id);
    return NextResponse.json({ collection: settings.collection }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/v1/collection failed:", err);
    return serverError("Could not load the collection page settings.");
  }
}

export async function PUT(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const { body, error } = await readJsonBody(request);
  if (error) return error;

  const parsed = CollectionPutSchema.safeParse(body);
  if (!parsed.success) return badRequest(firstZodError(parsed.error));

  // Absent optional fields are cleared, not kept. That is what makes this a
  // replacement rather than a second PATCH wearing a different verb.
  return save(tenant, {
    welcome_text: parsed.data.welcome_text,
    thank_you_text: parsed.data.thank_you_text,
    description: parsed.data.description ?? COLLECTION_DEFAULTS.description,
    prompt_questions: parsed.data.prompt_questions ?? [],
  });
}

export async function PATCH(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const { body, error } = await readJsonBody(request);
  if (error) return error;

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return badRequest(firstZodError(parsed.error));

  return save(tenant, parsed.data);
}

export async function DELETE(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  try {
    const settings = await resetApiCollection(tenant.id);
    revalidate(tenant.id);
    return NextResponse.json(
      { reset: true, collection: settings.collection },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("DELETE /api/v1/collection failed:", err);
    return serverError("Could not reset the collection page settings.");
  }
}

function revalidate(tenantId: string) {
  revalidatePath("/video/dashboard/settings");
  revalidatePath(`/video/admin/tenants/${tenantId}`);
}

async function save(
  tenant: { id: string },
  collection: Parameters<typeof applyApiSettings>[1]["collection"],
) {
  try {
    const settings = await applyApiSettings(tenant.id, { collection });
    revalidate(tenant.id);
    return NextResponse.json({ collection: settings.collection }, { headers: NO_STORE });
  } catch (err) {
    console.error("Saving /api/v1/collection failed:", err);
    return serverError("Could not save the collection page settings.");
  }
}
