/**
 * The video length limit, end to end.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-video-limit.ts [baseUrl]
 *
 * Drives the real collection page in a real browser with a FAKE CAMERA, so the
 * recorder's clock and its hard stop actually run rather than being asserted about.
 *
 * Then proves the limit is not merely cosmetic: a tenant_admin cannot raise their
 * own ceiling, because max_video_seconds is absent from the `authenticated` column
 * grants and Postgres refuses the UPDATE.
 *
 * The cap is temporarily set to 20 seconds for the run, then restored -- waiting
 * out a 3-minute default would make this untestable in practice.
 */
import { chromium, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SLUG = process.env.SEED_TENANT_SLUG ?? "webuildtrades";

/** Short enough to wait out, long enough that a broken clock can't pass by luck. */
const TEST_CAP_SECONDS = 20;

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

async function login(ctx: BrowserContext, email: string, password: string, expect: string) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/video/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('form:has(#email) button[type="submit"]');
  await page.waitForURL((u) => new URL(u).pathname === expect, { timeout: 20000 });
  return page;
}

async function main() {
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, max_video_seconds")
    .eq("slug", SLUG)
    .single();

  if (!tenant) throw new Error(`No tenant with slug "${SLUG}". Run: npm run seed`);

  const original = tenant.max_video_seconds;
  console.log(`Tenant cap is ${original}s. Setting it to ${TEST_CAP_SECONDS}s for this run.\n`);

  check("column exists with a default", typeof original === "number" && original > 0, `got ${original}`);

  await admin
    .from("tenants")
    .update({ max_video_seconds: TEST_CAP_SECONDS })
    .eq("id", tenant.id);

  try {
    // ------------------------------------------------- the database is the gate
    console.log("Authorization");

    const asTenant = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { error: signInError } = await asTenant.auth.signInWithPassword({
      email: process.env.SEED_TENANT_ADMIN_EMAIL!,
      password: process.env.SEED_TENANT_ADMIN_PASSWORD!,
    });
    if (signInError) throw new Error(`Tenant admin login failed: ${signInError.message}`);

    // The tenant owns this row and RLS lets them update it. The COLUMN grant is
    // what must stop them here, so a pass proves the grant, not the policy.
    const { error: grantError } = await asTenant
      .from("tenants")
      .update({ max_video_seconds: 1800 })
      .eq("id", tenant.id);

    const { data: afterAttempt } = await admin
      .from("tenants")
      .select("max_video_seconds")
      .eq("id", tenant.id)
      .single();

    check(
      "a tenant_admin cannot raise their own cap",
      Boolean(grantError) && afterAttempt?.max_video_seconds === TEST_CAP_SECONDS,
      grantError ? "" : `no error, and the cap is now ${afterAttempt?.max_video_seconds}s`,
    );
    if (grantError) console.log(`        (Postgres said: ${grantError.message})`);

    // The tenant may still write the columns they legitimately own.
    const { error: brandError } = await asTenant
      .from("tenants")
      .update({ brand_color: "#8A9A5B" })
      .eq("id", tenant.id);
    check("the same tenant can still edit their own branding", !brandError, brandError?.message);

    // ---------------------------------------------------- the recorder stops itself
    console.log("\nRecorder");

    const browser = await chromium.launch({
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });
    const ctx = await browser.newContext({
      permissions: ["camera", "microphone"],
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(`${BASE}/c/${SLUG}`, { waitUntil: "networkidle" });
    await page.click('button:has-text("Record a video")');

    const copy = await page.textContent("body");
    check(
      "the collection page states the limit up front",
      Boolean(copy?.includes(`${TEST_CAP_SECONDS} seconds`)),
      "expected the cap in the intro copy",
    );

    await page.click('button:has-text("Turn on camera")');
    await page.waitForSelector('button:has-text("Start recording")', { timeout: 20000 });

    await page.click('button:has-text("Start recording")');
    const startedAt = Date.now();

    // The timer must show the cap alongside the elapsed time.
    const timer = await page.textContent(".font-mono");
    check(
      "the timer counts against the cap",
      Boolean(timer?.includes("00:20")),
      `timer read "${timer?.trim()}"`,
    );

    // Nobody clicks Stop. If the hard stop is broken, this times out.
    await page.waitForSelector('button:has-text("Re-record")', {
      timeout: (TEST_CAP_SECONDS + 15) * 1000,
    });
    const elapsed = (Date.now() - startedAt) / 1000;

    check(
      "recording stops itself at the cap, with no Stop click",
      elapsed >= TEST_CAP_SECONDS && elapsed < TEST_CAP_SECONDS + 8,
      `stopped after ${elapsed.toFixed(1)}s, expected ~${TEST_CAP_SECONDS}s`,
    );
    console.log(`        (auto-stopped after ${elapsed.toFixed(1)}s)`);

    const stoppedCopy = await page.textContent("body");
    check(
      "the reviewer is told why it stopped",
      Boolean(stoppedCopy?.includes("maximum length")),
      "expected an explanation after the auto-stop",
    );

    // The captured video must survive the auto-stop: a stop that fires from a timer
    // rather than a click still has to flush MediaRecorder's chunks.
    await page.click('button:has-text("Save video")');
    const onDetails = await page.waitForSelector("#name", { timeout: 5000 }).catch(() => null);
    check("the recording is kept and can be submitted", Boolean(onDetails));

    check("no client-side errors", errors.length === 0, errors.slice(0, 2).join(" | "));

    // ------------------------------------------------------------- the admin side
    console.log("\nAdmin");

    const agency = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const agencyPage = await login(
      agency,
      process.env.SEED_SUPER_ADMIN_EMAIL!,
      process.env.SEED_SUPER_ADMIN_PASSWORD!,
      "/video/admin",
    );
    await agencyPage.goto(`${BASE}/video/admin/tenants/${tenant.id}?tab=collect`, {
      waitUntil: "networkidle",
    });

    check("the agency gets a video length control", await agencyPage.isVisible("#maxVideoSeconds"));
    check(
      "it shows the tenant's current cap",
      Number(await agencyPage.inputValue("#maxVideoSeconds")) === TEST_CAP_SECONDS,
    );

    await agencyPage.selectOption("#maxVideoSeconds", "60");
    await agencyPage.click('form:has(#maxVideoSeconds) button[type="submit"]');
    await agencyPage.waitForSelector("text=capped at 1 minute", { timeout: 15000 });

    const { data: saved } = await admin
      .from("tenants")
      .select("max_video_seconds")
      .eq("id", tenant.id)
      .single();
    check(
      "saving writes the new cap",
      saved?.max_video_seconds === 60,
      `the row holds ${saved?.max_video_seconds}s`,
    );

    // The reviewer's page must pick it up with no further action.
    const reviewer = await ctx.newPage();
    await reviewer.goto(`${BASE}/c/${SLUG}`, { waitUntil: "networkidle" });
    await reviewer.click('button:has-text("Record a video")');
    const newCopy = await reviewer.textContent("body");
    check("the collection page picks the new cap up at once", Boolean(newCopy?.includes("1 minute")));

    // A tenant must not even be offered the control -- the grant would refuse the
    // write, but they should never see a knob they cannot turn.
    const tenantCtx = await browser.newContext();
    const tenantPage = await login(
      tenantCtx,
      process.env.SEED_TENANT_ADMIN_EMAIL!,
      process.env.SEED_TENANT_ADMIN_PASSWORD!,
      "/video/dashboard",
    );
    await tenantPage.goto(`${BASE}/video/dashboard/settings?tab=collect`, { waitUntil: "networkidle" });
    check(
      "the tenant is never shown the control",
      !(await tenantPage.isVisible("#maxVideoSeconds")),
    );

    await browser.close();
  } finally {
    await admin
      .from("tenants")
      .update({ max_video_seconds: original })
      .eq("id", tenant.id);
    console.log(`\nRestored the cap to ${original}s.`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
