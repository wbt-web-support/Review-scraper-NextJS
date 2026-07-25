/**
 * Tenant settings on both surfaces.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-settings.ts [baseUrl]
 *
 * The same settings panel is rendered on /dashboard/settings (a tenant editing
 * themselves) and /admin/tenants/[id] (a super admin editing a tenant). Every form
 * carries a hidden tenantId.
 *
 * THE SECURITY PROPERTY: that hidden field is honoured only for super admins.
 * A tenant_admin who edits it in devtools must still only be able to write their
 * own tenant. That is what resolveWritableTenantId enforces, with RLS underneath
 * as the backstop. This test forges the field and proves nothing happens.
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SLUG = process.env.SEED_TENANT_SLUG ?? "webuildtrades";

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
  await page.waitForURL((u) => new URL(u).pathname === expect, { timeout: 15000 });
  return page;
}

/** Saves the branding form and waits for its own status message. */
async function saveBranding(page: Page) {
  await page.click('form:has(#name) button[type="submit"]');
  await page
    .locator('form:has(#name) [role="status"], form:has(#name) [role="alert"]')
    .first()
    .waitFor({ timeout: 15000 });
}

async function main() {
  const stamp = Date.now();
  const browser = await chromium.launch();

  const { data: seeded } = await admin
    .from("tenants")
    .select("id, name, brand_color")
    .eq("slug", SLUG)
    .single();

  // A second tenant, to be the victim of the forgery attempt.
  const victimSlug = `victim-${stamp}`;
  const { data: victim } = await admin
    .from("tenants")
    .insert({
      name: `Victim Co ${stamp}`,
      slug: victimSlug,
      subdomain: victimSlug,
      brand_color: "#123456",
    })
    .select("id, name, brand_color")
    .single();

  // ================================================== super admin
  console.log("Super admin editing a tenant from /admin/tenants/[id]");
  const adminCtx = await browser.newContext();
  const aPage = await login(
    adminCtx,
    process.env.SEED_SUPER_ADMIN_EMAIL!,
    process.env.SEED_SUPER_ADMIN_PASSWORD!,
    "/video/admin",
  );

  const base = `${BASE}/video/admin/tenants/${seeded!.id}`;

  await aPage.goto(base, { waitUntil: "networkidle" });
  check("admin lands on the Collection tab by default", (await aPage.locator("body").innerText()).includes("Collection page"));
  // Six, per SETTINGS_TABS in vrm/components/settings/tenant-settings.tsx, all of
  // which a super_admin sees. This said 4 until the 'reviews' and 'api' tabs were
  // added without updating it, so it had been failing on its own for a while.
  check("sidebar lists every settings tab", (await aPage.locator("nav[aria-label='Settings sections'] a").count()) === 6);

  await aPage.goto(`${base}?tab=widget`, { waitUntil: "load" });
  // Read the DOM, not innerText: the data-target variant sits inside a collapsed
  // <details>, whose text innerText does not return.
  const widgetHtml = await aPage.content();
  check("Widget tab shows the embed code", widgetHtml.includes("data-tenant="));
  check("embed code carries the layout", widgetHtml.includes("data-layout="));
  check("a data-target variant is offered", widgetHtml.includes("data-target="));

  // Agency-only control: how "Leave a review" opens.
  const widgetTab = await aPage.locator("body").innerText();
  check("admin sees the 'Leave a review button' control", widgetTab.includes("Leave a review button"));
  check("...with both modes", widgetTab.includes("Open in a dialog") && widgetTab.includes("Open in a new tab"));

  await aPage.goto(`${base}?tab=domain`, { waitUntil: "networkidle" });
  check("Domain tab shows the custom domain form", (await aPage.locator("body").innerText()).includes("Custom domain"));

  // Edit the tenant's branding as the super admin.
  await aPage.goto(`${base}?tab=branding`, { waitUntil: "networkidle" });
  const newName = `We Build Trades ${stamp}`;
  await aPage.fill("#name", newName);
  await aPage.fill("#contactPhone", "01234 567890");
  await saveBranding(aPage);

  let updated: { name: string; contact_phone: string | null } | null = null;
  for (let i = 0; i < 20; i++) {
    const { data } = await admin
      .from("tenants")
      .select("name, contact_phone")
      .eq("id", seeded!.id)
      .single();
    updated = data;
    if (updated?.name === newName) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check("super admin can edit a tenant's branding", updated?.name === newName, `name is "${updated?.name}"`);
  check("super admin can edit contact details", updated?.contact_phone === "01234 567890");

  // Collection page copy lives on the collect tab.
  await aPage.goto(`${base}?tab=collect`, { waitUntil: "networkidle" });
  await aPage.fill("#welcomeText", `Edited by admin ${stamp}`);
  await aPage.click('form:has(#welcomeText) button[type="submit"]');
  await aPage
    .locator('form:has(#welcomeText) [role="status"], form:has(#welcomeText) [role="alert"]')
    .first()
    .waitFor({ timeout: 15000 });

  const { data: settings } = await admin
    .from("collection_settings")
    .select("welcome_text")
    .eq("tenant_id", seeded!.id)
    .single();
  check(
    "super admin can edit the collection page copy",
    settings?.welcome_text === `Edited by admin ${stamp}`,
    `got "${settings?.welcome_text}"`,
  );

  await adminCtx.close();

  // ================================================== tenant admin
  console.log("\nTenant admin editing their own settings");
  const tenantCtx = await browser.newContext();
  const tPage = await login(
    tenantCtx,
    process.env.SEED_TENANT_ADMIN_EMAIL!,
    process.env.SEED_TENANT_ADMIN_PASSWORD!,
    "/video/dashboard",
  );

  await tPage.goto(`${BASE}/video/dashboard/settings?tab=widget`, { waitUntil: "load" });
  check(
    "tenant does NOT see the agency-only 'Leave a review button' control",
    !(await tPage.locator("body").innerText()).includes("Leave a review button"),
  );

  await tPage.goto(`${BASE}/video/dashboard/settings?tab=branding`, { waitUntil: "networkidle" });
  check("tenant sees the same settings panel", (await tPage.locator("body").innerText()).includes("Branding"));

  const ownName = `Self Edited ${stamp}`;
  await tPage.fill("#name", ownName);
  await saveBranding(tPage);

  let own: { name: string } | null = null;
  for (let i = 0; i < 20; i++) {
    const { data } = await admin.from("tenants").select("name").eq("id", seeded!.id).single();
    own = data;
    if (own?.name === ownName) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check("tenant can edit their OWN branding", own?.name === ownName);

  // ============================================ THE FORGERY
  console.log("\nTenant admin forging the hidden tenantId");

  // Point the hidden field at the victim tenant and try to rename them.
  await tPage.evaluate((victimId) => {
    const form = document.querySelector("form:has(#name)") as HTMLFormElement;
    const hidden = form.querySelector('input[name="tenantId"]') as HTMLInputElement;
    hidden.value = victimId;
    (form.querySelector("#name") as HTMLInputElement).value = "PWNED";
  }, victim!.id);

  await saveBranding(tPage);
  await new Promise((r) => setTimeout(r, 1500));

  const { data: victimAfter } = await admin
    .from("tenants")
    .select("name, brand_color")
    .eq("id", victim!.id)
    .single();

  check(
    "a forged tenantId does NOT let a tenant admin rename another business",
    victimAfter?.name === victim!.name,
    `victim is now named "${victimAfter?.name}" — cross-tenant write succeeded`,
  );
  check(
    "the victim's branding is untouched",
    victimAfter?.brand_color === "#123456",
    `brand colour is now ${victimAfter?.brand_color}`,
  );

  // The write must have landed on their OWN tenant instead (the form value is
  // ignored, not rejected) -- or been refused. Either is safe; what matters is the
  // victim is untouched.
  const { data: selfAfter } = await admin
    .from("tenants")
    .select("name")
    .eq("id", seeded!.id)
    .single();
  check(
    "the forged write was redirected to their own tenant, not the victim's",
    selfAfter?.name === "PWNED" || selfAfter?.name === ownName,
    `own tenant is named "${selfAfter?.name}"`,
  );

  await tenantCtx.close();

  // ---------------------------------------------------------------- cleanup
  await admin
    .from("tenants")
    .update({ name: seeded!.name, brand_color: seeded!.brand_color, contact_phone: null })
    .eq("id", seeded!.id);
  await admin
    .from("collection_settings")
    .update({ welcome_text: "Tell us how we did." })
    .eq("tenant_id", seeded!.id);
  await admin.from("tenants").delete().eq("id", victim!.id);

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
