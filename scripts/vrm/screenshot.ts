/**
 * Screenshots every main screen, desktop and mobile.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/screenshot.ts [baseUrl]
 */
import { chromium, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SLUG = process.env.SEED_TENANT_SLUG ?? "webuildtrades";
const OUT = "screenshots";

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function login(ctx: BrowserContext, email: string, password: string, expect: string) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/video/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('form:has(#email) button[type="submit"]');
  await page.waitForURL((u) => new URL(u).pathname === expect, { timeout: 15000 });
  return page;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: tenant } = await admin
    .from("tenants")
    .select("embed_key, subdomain")
    .eq("slug", SLUG)
    .single();

  const shot = async (name: string, fn: (p: Awaited<ReturnType<BrowserContext["newPage"]>>) => Promise<void>, viewport = DESKTOP, ctx?: BrowserContext) => {
    const context = ctx ?? (await browser.newContext({ viewport }));
    const page = await context.newPage();
    await fn(page);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`  ${OUT}/${name}.png`);
    await page.close();
    if (!ctx) await context.close();
  };

  // Public
  await shot("login-desktop", async (p) => { await p.goto(`${BASE}/video/login`); });
  await shot("collect-intro", async (p) => { await p.goto(`${BASE}/c/${SLUG}`); }, MOBILE);
  await shot("collect-record", async (p) => {
    await p.goto(`${BASE}/c/${SLUG}`, { waitUntil: "networkidle" });
    await p.click('button:has-text("Record a video")');
  }, MOBILE);
  await shot("collect-details", async (p) => {
    await p.goto(`${BASE}/c/${SLUG}`, { waitUntil: "networkidle" });
    await p.click('button:has-text("Write a review instead")');
    await p.fill("textarea", "Superb work, on time and on budget.");
    await p.click('button:has-text("Continue")');
    await p.fill("#name", "Sam Whitfield");
    await p.click('button[aria-label="5 stars"]');
  }, MOBILE);
  await shot("subdomain", async (p) => { await p.goto(`${BASE}/s/${tenant!.subdomain}`); });
  await shot("widget-embed", async (p) => {
    await p.goto(`${BASE}/widget-demo.html`, { waitUntil: "networkidle" });
    await p.evaluate((key) => {
      document.querySelectorAll("script[data-tenant]").forEach((el) => el.remove());
      document.querySelectorAll("div").forEach((d) => { if (d.shadowRoot) d.remove(); });
      const s = document.createElement("script");
      s.src = "/w.js";
      s.setAttribute("data-tenant", key);
      document.querySelector(".page")!.appendChild(s);
    }, tenant!.embed_key);
    await p.waitForFunction(
      () => Array.from(document.querySelectorAll("div")).some((d) => d.shadowRoot?.querySelector(".card")),
      { timeout: 15000 },
    );
  });

  // Super admin
  const adminCtx = await browser.newContext({ viewport: DESKTOP });
  await login(adminCtx, process.env.SEED_SUPER_ADMIN_EMAIL!, process.env.SEED_SUPER_ADMIN_PASSWORD!, "/video/admin");
  await shot("admin-tenants", async (p) => { await p.goto(`${BASE}/video/admin`); }, DESKTOP, adminCtx);
  await shot("admin-new-tenant", async (p) => {
    await p.goto(`${BASE}/video/admin`, { waitUntil: "networkidle" });
    await p.click('button:has-text("New tenant")');
    await p.waitForSelector("dialog[open] #name");
    await p.fill("#name", "Acme Renewables");
    await p.fill("#contactEmail", "owner@acmerenewables.co.uk");
  }, DESKTOP, adminCtx);
  await shot("admin-tenant-detail", async (p) => {
    await p.goto(`${BASE}/video/admin`, { waitUntil: "networkidle" });
    await p.locator('tbody a[href^="/video/admin/tenants/"]').first().click();
    await p.waitForURL(/\/admin\/tenants\/[0-9a-f-]{36}$/);
  }, DESKTOP, adminCtx);
  await adminCtx.close();

  // Tenant admin
  const tenantCtx = await browser.newContext({ viewport: DESKTOP });
  await login(tenantCtx, process.env.SEED_TENANT_ADMIN_EMAIL!, process.env.SEED_TENANT_ADMIN_PASSWORD!, "/video/dashboard");
  await shot("dashboard", async (p) => { await p.goto(`${BASE}/video/dashboard`); }, DESKTOP, tenantCtx);
  await shot("dashboard-approved", async (p) => { await p.goto(`${BASE}/video/dashboard?status=approved`); }, DESKTOP, tenantCtx);
  await shot("dashboard-settings", async (p) => { await p.goto(`${BASE}/video/dashboard/settings`); }, DESKTOP, tenantCtx);
  await tenantCtx.close();

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
