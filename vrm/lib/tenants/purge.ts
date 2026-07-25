import "@vrm/lib/server-guard";

import { createAdminClient } from "@vrm/lib/supabase/admin";
import { VIDEO_BUCKET, isStoragePath } from "@vrm/lib/video/provider";
import { deleteBunnyVideo, deleteBunnyCollection } from "@vrm/lib/bunny/client";
import { removeDomainFromVercel } from "@vrm/lib/vercel/client";

/**
 * Permanently delete a tenant and everything it owns. NO authorization of its own,
 * and no confirmation -- see provision.ts for why the split exists.
 *
 * Every caller must authorize before calling, and must have already confirmed the
 * intent with whoever asked for it. This function does not ask twice.
 *
 * `on delete cascade` takes care of the rows: profiles, reviews,
 * collection_settings, widget_settings all go with the tenant. But two things do
 * NOT cascade, and both would be left behind as orphans:
 *
 *   1. auth.users -- the ON DELETE CASCADE runs the other way (deleting a user
 *      deletes their profile, not the reverse). Left alone, the owner keeps a
 *      working login into a tenant that no longer exists. They'd authenticate
 *      fine, get a token with no role, and see an empty app forever.
 *
 *   2. Stored videos -- neither a Bunny video nor a Supabase Storage object is a
 *      database row. Left alone, they sit there costing money, holding customers'
 *      faces and voices long after the business asked to be removed. That is a GDPR
 *      problem, not just an untidy one. On Bunny that means the videos AND the
 *      tenant's collection, in that order.
 *
 * So both are cleaned up explicitly, BEFORE the tenant row goes -- because once it
 * is gone, the profiles and reviews that tell us what to clean up are gone too.
 *
 * This is the ONLY implementation. Deleting a tenant from the scraper's widget list
 * must do all of the above too -- a "delete" that removed the Mongo row and the
 * tenant row but left the videos on Bunny would look like it worked and quietly be
 * a data-retention breach.
 */
export async function purgeTenant(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, custom_domain, bunny_collection_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, error: "That business no longer exists." };

  // 1. Their videos. Gather the storage paths before the rows disappear.
  const { data: reviews } = await admin
    .from("reviews")
    .select("video_guid, video_url")
    .eq("tenant_id", tenant.id)
    .not("video_guid", "is", null);

  const storagePaths = (reviews ?? [])
    // Bunny GUIDs are not storage paths. Only Supabase-hosted videos live in the
    // bucket, and those are the ones whose URL points at it.
    .filter((r) => r.video_url?.includes("/storage/v1/object/public/"))
    .map((r) => r.video_guid!)
    .filter(Boolean);

  if (storagePaths.length > 0) {
    const { error } = await admin.storage.from(VIDEO_BUCKET).remove(storagePaths);
    // Don't abort on a storage failure: a leftover file is better than a tenant
    // stuck half-deleted. Log it loudly instead.
    if (error) {
      console.error(`Failed to remove ${storagePaths.length} videos for tenant ${tenant.id}:`, error.message);
    }
  }

  // The same job, on the Bunny side.
  const bunnyGuids = (reviews ?? [])
    .map((r) => r.video_guid!)
    .filter((guid) => guid && !isStoragePath(guid));

  for (const guid of bunnyGuids) {
    await deleteBunnyVideo(guid);
  }

  // Then the now-empty folder. Videos first, always: Bunny does not promise that
  // deleting a collection deletes what is in it, and the wrong order leaves the
  // videos stored, billed, and no longer attributable to anyone.
  if (tenant.bunny_collection_id) {
    await deleteBunnyCollection(tenant.bunny_collection_id);
  }

  // 2. Their custom domain. Not a database row either -- left attached, it squats
  //    on the hosting project forever and blocks anyone from ever claiming it again.
  if (tenant.custom_domain) {
    await removeDomainFromVercel(tenant.custom_domain);
  }

  // 3. Their logins.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenant.id);

  for (const profile of profiles ?? []) {
    const { error } = await admin.auth.admin.deleteUser(profile.id);
    if (error) {
      console.error(`Failed to delete auth user ${profile.id}:`, error.message);
    }
  }

  // 4. The tenant. Everything else cascades from here.
  const { error } = await admin.from("tenants").delete().eq("id", tenant.id);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/** The name a caller must have the user type to confirm a delete. */
export async function tenantNameForConfirm(tenantId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  return data?.name ?? null;
}
