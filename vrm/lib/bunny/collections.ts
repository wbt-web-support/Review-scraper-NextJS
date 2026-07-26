import "@vrm/lib/server-guard";

import { createAdminClient } from "@vrm/lib/supabase/admin";
import {
  isBunnyConfigured,
  createBunnyCollection,
  deleteBunnyCollection,
} from "@vrm/lib/bunny/client";

/**
 * One Bunny collection (folder) per tenant.
 *
 * Without this every client's testimonials pile up in the root of a single shared
 * library: nobody can tell whose video is whose, and cleaning up after one client
 * means picking their videos out of everyone else's by hand.
 */

/**
 * The folder label, as it appears in Bunny's dashboard.
 *
 * The slug is in there because two clients can genuinely be called "Smith
 * Plumbing", and a folder you cannot attribute is barely better than no folder.
 * The slug is unique, so this label always is too.
 */
export function collectionName(name: string, slug: string): string {
  return `${name} (${slug})`;
}

/**
 * Forget a tenant's stored collection GUID.
 *
 * Used when Bunny rejects it with "Collection does not exist" -- which happens when
 * the id belongs to a different library (the library was switched) or the folder was
 * deleted. Clearing it lets ensureTenantCollection mint a fresh one in the CURRENT
 * library on the next upload. Best-effort; never throws.
 */
export async function forgetTenantCollection(tenantId: string): Promise<void> {
  if (!isBunnyConfigured()) return;
  try {
    await createAdminClient()
      .from("tenants")
      .update({ bunny_collection_id: null })
      .eq("id", tenantId);
  } catch (err) {
    console.error(`Could not clear stale Bunny collection for tenant ${tenantId}:`, err);
  }
}

/**
 * The tenant's collection GUID, creating it on first use.
 *
 * Returns null when there is nothing to file into: Bunny isn't configured (the
 * Supabase fallback already folders by tenant), or the tenant is gone.
 *
 * NEVER THROWS. A failure here returns null and the video is created in the
 * library root instead. That is deliberate: a misfiled testimonial can be swept
 * up later by scripts/backfill-bunny-collections.ts, but a customer who was told
 * "something went wrong" while a Bunny API call flaked is gone for good. Tidiness
 * is not worth a lost testimonial.
 */
export async function ensureTenantCollection(tenantId: string): Promise<string | null> {
  if (!isBunnyConfigured()) return null;

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("name, slug, bunny_collection_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return null;
  if (tenant.bunny_collection_id) return tenant.bunny_collection_id;

  try {
    const guid = await createBunnyCollection(collectionName(tenant.name, tenant.slug));

    // Claim it -- but only if nobody else has. Two customers hitting a brand new
    // tenant's collection page at the same moment both find bunny_collection_id
    // null and both create a folder; `is null` in the WHERE clause means exactly
    // one of them gets to keep it.
    const { data: claimed } = await admin
      .from("tenants")
      .update({ bunny_collection_id: guid })
      .eq("id", tenantId)
      .is("bunny_collection_id", null)
      .select("bunny_collection_id")
      .maybeSingle();

    if (claimed?.bunny_collection_id) return claimed.bunny_collection_id;

    // We lost the race. Bin our duplicate (it is empty -- no video has been
    // created into it yet) and use the winner's.
    await deleteBunnyCollection(guid);

    const { data: winner } = await admin
      .from("tenants")
      .select("bunny_collection_id")
      .eq("id", tenantId)
      .maybeSingle();

    return winner?.bunny_collection_id ?? null;
  } catch (err) {
    console.error(`Could not create a Bunny collection for tenant ${tenantId}:`, err);
    return null; // the video still uploads; it just lands unfiled
  }
}
