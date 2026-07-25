/**
 * Deleting a review, end to end, from both sides.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-review-delete.ts [baseUrl]
 *
 * Proves the three things that matter about an irreversible, destructive action:
 *
 *   1. The tenant can delete their own review, and the VIDEO really leaves Bunny.
 *      A row deleted while the video stays behind is a bill and a GDPR liability,
 *      and nothing in the app would ever show it again.
 *   2. The agency can delete a client's review without impersonating them.
 *   3. A tenant CANNOT delete another tenant's review. RLS refuses it.
 *
 * Test videos are created in Bunny via the API with no bytes uploaded: enough for a
 * real video record to exist and really be deleted, without a 60-second upload.
 */
import { chromium, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SLUG = process.env.SEED_TENANT_SLUG ?? "webuildtrades";

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const API_KEY = process.env.BUNNY_STREAM_API_KEY;
const API_BASE = "https://video.bunnycdn.com/library";
const USING_BUNNY = Boolean(LIBRARY_ID && API_KEY);

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function createBunnyVideo(title: string): Promise<string | null> {
  if (!USING_BUNNY) return null;
  const res = await fetch(`${API_BASE}/${LIBRARY_ID}/videos`, {
    method: "POST",
    headers: { AccessKey: API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Bunny createVideo: ${res.status}`);
  return ((await res.json()) as { guid: string }).guid;
}

/** True when Bunny still holds the video. */
async function bunnyHasVideo(guid: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/${LIBRARY_ID}/videos/${guid}`, {
    headers: { AccessKey: API_KEY! },
  });
  return res.ok;
}

/** A pending video review, with a real Bunny video behind it. */
async function seedReview(tenantId: string, name: string) {
  const videoGuid = await createBunnyVideo(`DELETE PROBE ${name}`);

  const { data, error } = await admin
    .from("reviews")
    .insert({
      tenant_id: tenantId,
      reviewer_name: name,
      rating: 5,
      type: "video",
      status: "pending",
      consent_given: true,
      video_guid: videoGuid ?? `${tenantId}/probe-${name}.webm`,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id as string, videoGuid };
}

async function reviewExists(id: string): Promise<boolean> {
  const { data } = await admin.from("reviews").select("id").eq("id", id).maybeSingle();
  return Boolean(data);
}

async function login(ctx: BrowserContext, email: string, password: string, expect: string) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/video/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('form:has(#email) button[type="submit"]');
  await page.waitForURL((u) => new URL(u).pathname === expect, { timeout: 20000 });
  return page;
}

/** Finds the card for a reviewer, hits Delete, confirms in the dialog. */
async function deleteFromCard(page: import("playwright").Page, name: string) {
  const card = page.locator("article", { hasText: name });
  await card.first().waitFor({ timeout: 15000 });
  await card.first().getByRole("button", { name: "Delete", exact: true }).click();

  const dialog = page.locator("dialog[open]");
  await dialog.waitFor({ timeout: 5000 });
  await dialog.getByRole("button", { name: "Delete permanently" }).click();

  // The row is gone and the card unmounts.
  await page.waitForFunction(
    (n) => !Array.from(document.querySelectorAll("article")).some((a) => a.textContent?.includes(n)),
    name,
    { timeout: 20000 },
  );
}

async function main() {
  const stamp = Date.now();
  console.log(`Provider: ${USING_BUNNY ? "Bunny Stream" : "Supabase Storage (fallback)"}\n`);

  const { data: own } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", SLUG)
    .single();

  // Somebody else, for the cross-tenant check.
  const { data: other } = await admin
    .from("tenants")
    .select("id, name")
    .neq("slug", SLUG)
    .limit(1)
    .maybeSingle();

  const browser = await chromium.launch();

  // ------------------------------------------------------- the tenant's own review
  console.log("Tenant deletes their own review");
  const mine = await seedReview(own!.id, `Delete Probe Tenant ${stamp}`);

  if (USING_BUNNY) {
    check("the test video exists in Bunny to begin with", await bunnyHasVideo(mine.videoGuid!));
  }

  const tenantCtx = await browser.newContext();
  const tenantPage = await login(
    tenantCtx,
    process.env.SEED_TENANT_ADMIN_EMAIL!,
    process.env.SEED_TENANT_ADMIN_PASSWORD!,
    "/video/dashboard",
  );

  await deleteFromCard(tenantPage, `Delete Probe Tenant ${stamp}`);

  check("the review row is gone", !(await reviewExists(mine.id)));
  if (USING_BUNNY) {
    check(
      "the video is really gone from Bunny, not just the row",
      !(await bunnyHasVideo(mine.videoGuid!)),
      "Bunny still holds the video: a bill and a GDPR liability nothing can now find",
    );
  }

  // ------------------------------------------------ another tenant's review: refused
  if (other) {
    console.log("\nA tenant cannot delete someone else's review");
    const theirs = await seedReview(other.id, `Delete Probe Foreign ${stamp}`);

    // Straight at the database as the tenant admin, bypassing our UI entirely. The
    // reviews_delete policy (has_tenant_access) is the only thing standing here.
    const asTenant = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    await asTenant.auth.signInWithPassword({
      email: process.env.SEED_TENANT_ADMIN_EMAIL!,
      password: process.env.SEED_TENANT_ADMIN_PASSWORD!,
    });
    await asTenant.from("reviews").delete().eq("id", theirs.id);

    check(
      "RLS keeps another tenant's review alive",
      await reviewExists(theirs.id),
      `${other.name}'s review was deleted by a different tenant's admin`,
    );

    // ------------------------------------------------------ the agency deletes it
    console.log("\nThe agency deletes a client's review");
    const agencyCtx = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
    const agencyPage = await login(
      agencyCtx,
      process.env.SEED_SUPER_ADMIN_EMAIL!,
      process.env.SEED_SUPER_ADMIN_PASSWORD!,
      "/video/admin",
    );
    await agencyPage.goto(`${BASE}/video/admin/tenants/${other.id}?tab=reviews&status=all`, {
      waitUntil: "networkidle",
    });

    await deleteFromCard(agencyPage, `Delete Probe Foreign ${stamp}`);

    check("the agency's delete removed the row", !(await reviewExists(theirs.id)));
    if (USING_BUNNY) {
      check("and the video with it", !(await bunnyHasVideo(theirs.videoGuid!)));
    }
  }

  await browser.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
