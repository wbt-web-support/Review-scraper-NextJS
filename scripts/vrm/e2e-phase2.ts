/**
 * Drives the Phase 2 super-admin flows in a real browser.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-phase2.ts [baseUrl]
 *
 * Covers: tenant list, create tenant (slug/subdomain/embed key generation),
 * detail page, invite a tenant admin, impersonate + exit, and -- most importantly
 * -- that a tenant_admin forging the impersonation cookie gains nothing.
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";

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

async function login(ctx: BrowserContext, email: string, password: string, expect: string) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/video/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => new URL(u).pathname === expect, { timeout: 15000 });
  return page;
}

async function main() {
  const stamp = Date.now();
  const tenantName = `Probe Renewables ${stamp}`;
  const inviteEmail = `probe+${stamp}@webuildtrades.com`;

  const browser = await chromium.launch();

  // ---------------------------------------------------------------- super admin
  console.log("Super admin");
  const adminCtx = await browser.newContext();
  const page: Page = await login(
    adminCtx,
    process.env.SEED_SUPER_ADMIN_EMAIL!,
    process.env.SEED_SUPER_ADMIN_PASSWORD!,
    "/video/admin",
  );

  check("tenant list renders", (await page.locator("h1").textContent()) === "Tenants");
  check(
    "seeded tenant is listed",
    await page.getByText("We Build Trades").first().isVisible(),
  );

  // --- create a tenant, WITH its owner login, in one step (a dialog on /admin)
  await page.click('button:has-text("New tenant")');
  await page.waitForSelector("dialog[open] #name", { timeout: 10000 });
  check("new-tenant dialog opens on /admin", true);
  await page.fill("#name", tenantName);
  await page.fill("#contactEmail", inviteEmail);
  await page.fill("#contactPhone", "07700 900123");
  await page.fill("#adminPassword", "ProbePassword123");
  await page.fill("#rootDomain", `probe-${stamp}.com`);

  const preview = await page.locator("dialog[open]").innerText();
  check(
    "slug preview is derived from the name",
    preview.includes(`probe-renewables-${stamp}`),
  );
  check(
    "domain preview shows the review host they'll get",
    preview.includes(`review.probe-${stamp}.com`),
  );

  // Scope to the tenant form. A bare button[type=submit] would match the "Sign
  // out" button in the app shell header, which renders first in the DOM.
  await page.click('form:has(#name) button[type="submit"]');
  await page.waitForURL(/\/admin\/tenants\/[0-9a-f-]{36}$/, { timeout: 20000 });
  const tenantId = new URL(page.url()).pathname.split("/").pop()!;
  check("create redirects to the new tenant detail page", Boolean(tenantId));

  const body = await page.locator("body").innerText();
  check("detail shows the collection URL", body.includes(`/c/probe-renewables-${stamp}`));

  // Settings is tabbed; the embed snippet is on the widget tab.
  await page.goto(`${BASE}/video/admin/tenants/${tenantId}?tab=widget`, { waitUntil: "load" });
  check(
    "detail shows an embed snippet",
    (await page.locator("body").innerText()).includes("data-tenant="),
  );
  await page.goto(`${BASE}/video/admin/tenants/${tenantId}`, { waitUntil: "load" });
  check("detail shows the business contact details", body.includes(inviteEmail) && body.includes("07700 900123"));
  check("owner login was created alongside the tenant", body.includes(inviteEmail));

  // The embed key must not be the slug -- otherwise anyone with a collection link
  // could guess it.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: created } = await admin
    .from("tenants")
    .select("slug, subdomain, embed_key, custom_domain, custom_domain_verified")
    .eq("id", tenantId)
    .single();
  check("embed key is 32 hex chars", /^[0-9a-f]{32}$/.test(created?.embed_key ?? ""));

  // The domain given at creation.
  check(
    "domain is stored as the full review host",
    created?.custom_domain === `review.probe-${stamp}.com`,
    `stored ${created?.custom_domain}`,
  );
  // THE security property: claiming a domain at onboarding is not proof of owning
  // it. Nothing may serve on it until a DNS lookup says otherwise.
  check(
    "a domain claimed at creation is NOT verified",
    created?.custom_domain_verified === false,
    "a tenant could serve content on a domain they do not own",
  );
  const claimed = await fetch(`${BASE}/d/review.probe-${stamp}.com`);
  check(
    "...and it serves nothing (404) until DNS is verified",
    claimed.status === 404,
    `got HTTP ${claimed.status}`,
  );
  check("embed key is not the slug", created?.embed_key !== created?.slug);
  check("subdomain matches slug", created?.subdomain === created?.slug);

  const { data: settings } = await admin
    .from("collection_settings")
    .select("prompt_questions")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  check("collection settings were seeded for the new tenant", Boolean(settings));

  const { data: widget } = await admin
    .from("widget_settings")
    .select("layout")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  check("widget settings were seeded for the new tenant", Boolean(widget));

  // --- the owner login created above must actually work, scoped to THIS tenant
  const ownerCtx = await browser.newContext();
  const oPage = await login(ownerCtx, inviteEmail, "ProbePassword123", "/video/dashboard");
  check("the owner login works immediately", oPage.url().endsWith("/video/dashboard"));
  check(
    "owner sees their own (empty) tenant, not the seeded one",
    (await oPage.locator("dd").first().textContent())?.trim() === "0",
  );
  await ownerCtx.close();

  // --- re-using an email must fail BEFORE a tenant is created (no orphan rows)
  const { count: before } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true });

  await page.goto(`${BASE}/video/admin`, { waitUntil: "networkidle" });
  await page.click('button:has-text("New tenant")');
  await page.waitForSelector("dialog[open] #name", { timeout: 10000 });
  await page.fill("#name", `Duplicate Probe ${stamp}`);
  await page.fill("#contactEmail", inviteEmail); // already taken
  await page.fill("#adminPassword", "ProbePassword123");
  await page.click('form:has(#name) button[type="submit"]');
  // Scope to the form: a bare [role=alert] also matches the Next dev-tools overlay.
  const dupAlert = page.locator('form:has(#name) [role="alert"]');
  await dupAlert.first().waitFor({ timeout: 15000 });
  const dupErr = await dupAlert.first().textContent();
  check(
    "duplicate login email is rejected",
    (dupErr ?? "").toLowerCase().includes("already has an account"),
    `got "${dupErr}"`,
  );

  const { count: after } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true });
  check(
    "a rejected creation leaves NO orphan tenant behind",
    before === after,
    `tenant count went ${before} -> ${after}`,
  );

  // --- impersonate (back to the tenant we created; the duplicate test navigated away)
  await page.goto(`${BASE}/video/admin/tenants/${tenantId}`, { waitUntil: "load" });
  await page.click('button:has-text("View as this tenant")');
  await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
  const dash = await page.locator("body").innerText();
  check("impersonation lands on /dashboard", page.url().endsWith("/video/dashboard"));
  check("impersonation banner is shown", dash.includes("Viewing as a tenant"));
  // A brand-new tenant has no reviews at all, so it shows the first-run empty state.
  check(
    "dashboard is scoped to the impersonated tenant (0 reviews)",
    dash.includes("No reviews yet"),
  );

  await page.click('button:has-text("Exit")');
  await page.waitForURL(/\/admin$/, { timeout: 15000 });
  check("exiting impersonation returns to /admin", page.url().endsWith("/video/admin"));

  // ------------------------------------------------------------------ delete
  console.log("\nDeleting a tenant");

  // Give the probe tenant a review, so we can prove the cascade actually runs.
  await admin.from("reviews").insert({
    tenant_id: tenantId,
    reviewer_name: `Doomed Review ${stamp}`,
    rating: 5,
    type: "text",
    status: "approved",
    consent_given: true,
    text_review: "about to be deleted",
  });

  const { data: usersBefore } = await admin.auth.admin.listUsers({ perPage: 200 });
  const ownerExisted = usersBefore.users.some((u) => u.email === inviteEmail);
  check("the owner's login exists before deletion", ownerExisted);

  await page.goto(`${BASE}/video/admin/tenants/${tenantId}`, { waitUntil: "load" });
  await page.click('button:has-text("Delete this business")');
  await page.waitForSelector("dialog[open] #confirmName", { timeout: 10000 });
  check("delete asks for confirmation", true);

  const deleteBtn = page.locator('dialog[open] button:has-text("Delete permanently")');
  check("delete is DISABLED until the name is typed", await deleteBtn.isDisabled());

  await page.fill("dialog[open] #confirmName", "wrong name");
  check("...still disabled with the wrong name", await deleteBtn.isDisabled());

  await page.fill("dialog[open] #confirmName", tenantName);
  check("...enabled once the name matches", await deleteBtn.isEnabled());

  await deleteBtn.click();
  await page.waitForURL(/\/admin$/, { timeout: 20000 });
  check("deleting returns to the tenant list", page.url().endsWith("/video/admin"));

  const { data: goneTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  check("the tenant is gone", goneTenant === null);

  const { count: goneReviews } = await admin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  check("their reviews cascade away", goneReviews === 0);

  // The one that does NOT cascade, and would otherwise strand a working login into
  // a tenant that no longer exists.
  const { data: usersAfter } = await admin.auth.admin.listUsers({ perPage: 200 });
  check(
    "the owner's auth login is deleted too (no orphan users)",
    !usersAfter.users.some((u) => u.email === inviteEmail),
    "a login survived its tenant",
  );

  // -------------------------------------------------------------- tenant admin
  console.log("\nTenant admin");
  const tenantCtx = await browser.newContext();
  const tPage = await login(
    tenantCtx,
    process.env.SEED_TENANT_ADMIN_EMAIL!,
    process.env.SEED_TENANT_ADMIN_PASSWORD!,
    "/video/dashboard",
  );
  check("tenant admin reaches /dashboard", tPage.url().endsWith("/video/dashboard"));

  const { data: seeded } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", process.env.SEED_TENANT_SLUG ?? "webuildtrades")
    .single();
  const seededTenantId = seeded!.id;
  check(
    "tenant admin sees NO impersonation banner",
    !(await tPage.locator("body").innerText()).includes("Viewing as a tenant"),
  );

  await tPage.goto(`${BASE}/video/admin`);
  check("tenant admin is bounced from /admin", tPage.url().endsWith("/video/dashboard"));

  // --- THE important one: forge the impersonation cookie as a tenant_admin.
  // getTenantContext only reads the cookie once the verified JWT says super_admin,
  // so this must have no effect whatsoever.
  await tenantCtx.addCookies([
    {
      name: "vrm_impersonate_tenant",
      value: tenantId, // the probe tenant, which is NOT theirs
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await tPage.goto(`${BASE}/video/dashboard`, { waitUntil: "networkidle" });
  const forged = await tPage.locator("body").innerText();
  check(
    "forged impersonation cookie does NOT let a tenant admin view another tenant",
    !forged.includes("Viewing as a tenant"),
    "a tenant_admin escaped their tenant by setting a cookie",
  );

  // They must still see their OWN reviews, not the probe tenant's (which has none).
  // Derive the expected count rather than hardcoding it -- a hardcoded number turns
  // any leftover row into a false "isolation broke" alarm, which is exactly the
  // kind of noise that gets a real failure ignored.
  const { count: ownReviews } = await admin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", seededTenantId);

  const stillOwn = await tPage.locator("dd").first().textContent();
  check(
    "tenant admin still sees their own reviews, not the forged tenant's",
    stillOwn?.trim() === String(ownReviews) && (ownReviews ?? 0) > 0,
    `expected ${ownReviews} (their own), got "${stillOwn?.trim()}"`,
  );

  // ----------------------------------------------------------------- cleanup
  const { data: invited } = await admin.auth.admin.listUsers({ perPage: 200 });
  const probeUser = invited.users.find((u) => u.email === inviteEmail);
  if (probeUser) await admin.auth.admin.deleteUser(probeUser.id);
  await admin.from("tenants").delete().eq("id", tenantId);

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
