import "server-only";

import { z } from "zod/v4";
import { getSessionClaims, getTenantContext } from "@vrm/lib/auth/dal";

/**
 * Which tenant is this write allowed to touch?
 *
 * Two callers need to write tenant settings:
 *   - a tenant_admin on /dashboard/settings, editing their own
 *   - a super_admin on /admin/tenants/[id], editing someone else's
 *
 * The super admin must therefore be able to name a tenant. The tenant admin must
 * NOT -- so a tenantId in the form is honoured only when the verified JWT says
 * super_admin, and is otherwise ignored outright. A tenant admin who forges a
 * hidden field gets their own tenant back, not the one they asked for.
 *
 * RLS is still the backstop underneath all of this: even if the logic here were
 * wrong, tenants_update / has_tenant_access would refuse a cross-tenant write.
 */
export async function resolveWritableTenantId(
  formTenantId?: FormDataEntryValue | null,
): Promise<string> {
  const claims = await getSessionClaims();
  if (!claims) throw new Error("Unauthorized");

  if (claims.role === "super_admin") {
    const parsed = z.uuid().safeParse(formTenantId);
    // A super admin editing a named tenant.
    if (parsed.success) return parsed.data;
    // Otherwise they must be impersonating; getTenantContext supplies the tenant
    // from the view-as cookie, and bounces if there isn't one.
    return (await getTenantContext()).tenantId;
  }

  // tenant_admin: always their own tenant. The form value is ignored, not trusted.
  return (await getTenantContext()).tenantId;
}
