import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import {
  requireTenant,
  unauthorized,
  badRequest,
  serverError,
  readJsonBody,
  firstZodError,
  NO_STORE,
} from "@vrm/lib/api/auth";
import { getApiSettings, applyApiSettings } from "@vrm/lib/api/settings";
import {
  BrandingPatchSchema,
  CollectionPatchSchema,
  WidgetPatchSchema,
} from "@vrm/lib/api/schemas";

/**
 * The tenant's own settings.
 *
 *   GET   /api/v1/settings
 *   PATCH /api/v1/settings   {"branding":{"name":"Acme"},"widget":{"layout":"carousel"}}
 *
 * Everything the client can change about themselves in the dashboard: branding and
 * contact details, the collection page wording, and the widget layout. PATCH, not
 * PUT, and merged field by field -- sending one key changes one key and leaves the
 * rest alone.
 *
 * Not here on purpose: custom domain, video length, review open mode, and API key
 * rotation. The first three provision DNS or change what a recording costs, and
 * the last would let a caller cut the branch it is sitting on. Those stay in the
 * dashboard where a human confirms them.
 */

// Field rules live in one place, shared with /collection and /branding, which
// accept the same fields on their own. See vrm/lib/api/schemas.ts.
const PatchSchema = z
  .object({
    branding: BrandingPatchSchema.optional(),
    collection: CollectionPatchSchema.optional(),
    widget: WidgetPatchSchema.optional(),
  })
  // An empty body is a caller bug, and a silent 200 hides it.
  .refine((v) => v.branding || v.collection || v.widget, {
    error: "Send at least one of: branding, collection, widget.",
  });

export async function GET(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  try {
    const settings = await getApiSettings(tenant.id);
    return NextResponse.json(
      { tenant: { name: tenant.name, slug: tenant.slug }, ...settings },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("GET /api/v1/settings failed:", err);
    return serverError("Could not load settings.");
  }
}

export async function PATCH(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const { body, error } = await readJsonBody(request);
  if (error) return error;

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return badRequest(firstZodError(parsed.error));

  try {
    const settings = await applyApiSettings(tenant.id, parsed.data);

    // The collection page and the widget feed both render from these.
    revalidatePath("/video/dashboard/settings");
    revalidatePath(`/video/admin/tenants/${tenant.id}`);

    return NextResponse.json(
      { tenant: { name: tenant.name, slug: tenant.slug }, ...settings },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("PATCH /api/v1/settings failed:", err);
    return serverError("Could not save settings.");
  }
}
