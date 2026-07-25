/**
 * Files existing Bunny videos into their tenant's collection.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-bunny-collections.ts [--dry]
 *
 * Videos created before collections existed sit in the root of the library, every
 * tenant's mixed together. So does anything uploaded while a collection could not
 * be created (ensureTenantCollection lets the upload through rather than lose a
 * testimonial over a flaky API call). This sweeps both back into place.
 *
 * Safe to re-run: a tenant with a collection keeps it, and moving a video that is
 * already in the right collection is a no-op on Bunny's side.
 *
 * Talks to Bunny with plain fetch rather than importing src/lib/bunny -- those
 * modules are "server-only", which throws outside a Next server bundle. Every other
 * script here is standalone for the same reason.
 */
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const API_KEY = process.env.BUNNY_STREAM_API_KEY;
const API_BASE = "https://video.bunnycdn.com/library";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function createCollection(name: string): Promise<string> {
  const res = await fetch(`${API_BASE}/${LIBRARY_ID}/collections`, {
    method: "POST",
    headers: { AccessKey: API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`createCollection: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { guid?: string };
  if (!json.guid) throw new Error("createCollection returned no guid");
  return json.guid;
}

/** Bunny's update-video endpoint is a POST to the video; only the sent fields change. */
async function moveVideo(videoGuid: string, collectionId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/${LIBRARY_ID}/videos/${videoGuid}`, {
    method: "POST",
    headers: { AccessKey: API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ collectionId }),
  });
  if (!res.ok) console.error(`    moveVideo ${videoGuid}: ${res.status} ${await res.text()}`);
  return res.ok;
}

async function main() {
  if (!LIBRARY_ID || !API_KEY) {
    console.log("Bunny is not configured. Nothing to do: the Supabase Storage fallback");
    console.log("already stores videos under <tenant_id>/, which is a folder per tenant.");
    return;
  }

  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, name, slug, bunny_collection_id")
    .order("name");
  if (error) throw error;

  console.log(`${tenants!.length} tenant(s).${DRY ? "  DRY RUN, nothing will change." : ""}\n`);

  let moved = 0;
  let failed = 0;

  for (const tenant of tenants!) {
    // A Bunny GUID never contains a slash; a Supabase storage path always does
    // (<tenant_id>/<uuid>.webm). That is how the two are told apart everywhere.
    const { data: reviews } = await admin
      .from("reviews")
      .select("video_guid")
      .eq("tenant_id", tenant.id)
      .not("video_guid", "is", null);

    const guids = (reviews ?? [])
      .map((r) => r.video_guid as string)
      .filter((guid) => guid && !guid.includes("/"));

    if (guids.length === 0) {
      console.log(`  ${tenant.name}: no Bunny videos`);
      continue;
    }

    if (DRY) {
      console.log(
        `  ${tenant.name}: would file ${guids.length} video(s) into ${
          tenant.bunny_collection_id ?? "a new collection"
        }`,
      );
      continue;
    }

    let collectionId = tenant.bunny_collection_id;
    if (!collectionId) {
      // Same label the app uses: the slug disambiguates two clients with one name.
      collectionId = await createCollection(`${tenant.name} (${tenant.slug})`);
      const { error: claimError } = await admin
        .from("tenants")
        .update({ bunny_collection_id: collectionId })
        .eq("id", tenant.id);
      if (claimError) throw claimError;
      console.log(`  ${tenant.name}: created collection ${collectionId}`);
    }

    for (const guid of guids) {
      if (await moveVideo(guid, collectionId)) moved++;
      else failed++;
    }

    console.log(`  ${tenant.name}: filed ${guids.length} video(s) into ${collectionId}`);
  }

  if (!DRY) console.log(`\nFiled ${moved} video(s). ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
