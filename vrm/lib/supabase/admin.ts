import "@vrm/lib/server-guard";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@vrm/lib/env";

/**
 * Service-role client. BYPASSES RLS ENTIRELY.
 *
 * There is no user context and no tenant scoping. Every caller must have already
 * authorized the request (see assertRole in src/lib/auth/dal.ts) and must scope
 * its own queries by tenant_id. On these paths the calling code -- not the
 * database -- is the last line of defence.
 *
 * Legitimate uses:
 *   - super_admin cross-tenant reads
 *   - user/tenant provisioning (auth.admin.*, and the privileged columns that
 *     column-level grants deny to `authenticated`: profiles.role, tenants.plan)
 *   - the public collection-page submit route and widget read route, which have
 *     no authenticated user at all
 *   - trusted webhook handlers (Bunny encode callbacks)
 *
 * The server-guard import refuses to load in a browser bundle. It replaces
 * `import "server-only"`, which cannot be used here any more: the scraper's
 * /api/widgets provisions tenants, and a Pages Router API route does not get the
 * `react-server` export condition that makes that package a no-op. See
 * vrm/lib/server-guard.ts. Do not add an index.ts barrel to this directory: a
 * barrel re-exporting this file is the likeliest way the service-role key ends up
 * in a browser bundle.
 */
export function createAdminClient() {
  // Read lazily, inside the factory. A module-level const would run this check at
  // import time, which turns any accidental import into a hard crash rather than
  // a build-time `server-only` error.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
