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
  resetApiBranding,
} from "@vrm/lib/api/settings";
import {
  BrandingPatchSchema,
  BrandingPutSchema,
  requireSomeKey,
} from "@vrm/lib/api/schemas";

/**
 * Branding: the business name, colour, logo and contact details that dress the
 * collection page, the client login and the widget.
 *
 *   GET    /api/v1/branding   read it
 *   PUT    /api/v1/branding   replace it whole
 *   PATCH  /api/v1/branding   change some of it
 *   DELETE /api/v1/branding   clear the optional marks, keep the name
 *
 * PUT is a replacement: logo_url, contact_email and contact_phone left out are
 * CLEARED. name and brand_color are required, because neither has a sensible empty
 * state -- the page needs a heading and the widget needs a colour to theme with.
 * PATCH changes only what it is sent.
 *
 * On clearing a single field with PATCH, both `null` and `""` work. Omitting the
 * key means "leave it alone", which is the one thing it cannot also mean.
 *
 * Writes land through the same lib/tenantAdmin.updateBranding the dashboard form
 * uses, so an API change and a form change do the identical thing to the row --
 * including turning an empty logo into a real NULL rather than an empty string.
 */

const PatchSchema = requireSomeKey(
  BrandingPatchSchema,
  "name, brand_color, logo_url, contact_email, contact_phone",
);

export async function GET(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  try {
    const settings = await getApiSettings(tenant.id);
    return NextResponse.json({ branding: settings.branding }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/v1/branding failed:", err);
    return serverError("Could not load branding.");
  }
}

export async function PUT(request: NextRequest) {
  const tenant = await requireTenant(request);
  if (!tenant) return unauthorized();

  const { body, error } = await readJsonBody(request);
  if (error) return error;

  const parsed = BrandingPutSchema.safeParse(body);
  if (!parsed.success) return badRequest(firstZodError(parsed.error));

  // Omitted optional fields are cleared. A replacement that quietly kept the old
  // logo would not be a replacement.
  return save(tenant, {
    name: parsed.data.name,
    brand_color: parsed.data.brand_color,
    logo_url: parsed.data.logo_url ?? null,
    contact_email: parsed.data.contact_email ?? null,
    contact_phone: parsed.data.contact_phone ?? null,
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
    const settings = await resetApiBranding(tenant.id);
    revalidate(tenant.id);
    return NextResponse.json(
      { reset: true, branding: settings.branding },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("DELETE /api/v1/branding failed:", err);
    return serverError("Could not reset branding.");
  }
}

function revalidate(tenantId: string) {
  revalidatePath("/video/dashboard/settings");
  revalidatePath(`/video/admin/tenants/${tenantId}`);
}

async function save(
  tenant: { id: string },
  branding: Parameters<typeof applyApiSettings>[1]["branding"],
) {
  try {
    const settings = await applyApiSettings(tenant.id, { branding });
    revalidate(tenant.id);
    return NextResponse.json({ branding: settings.branding }, { headers: NO_STORE });
  } catch (err) {
    console.error("Saving /api/v1/branding failed:", err);
    return serverError("Could not save branding.");
  }
}
