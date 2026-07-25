/**
 * Custom domains: review.theirdomain.com
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-domain.ts [baseUrl]
 *
 * The security property under test: a tenant can CLAIM any hostname, but we must
 * serve NOTHING on it until a DNS lookup proves they control it. Without that,
 * anyone could type "review.bbc.co.uk" and have us render their reviews on the
 * BBC's domain.
 *
 * DNS is simulated by flipping custom_domain_verified with service_role -- exactly
 * what verifyCustomDomain() does after a successful lookup. The lookup itself is
 * Node's dns.resolveCname and needs no test of ours.
 */
import http from "node:http";
import { chromium, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";

/**
 * Raw request with a spoofed Host header -- exactly what a browser hitting
 * review.njdesignpark.com sends us.
 *
 * fetch() cannot do this: `host` is a forbidden header and undici drops it
 * silently, so the request would just go to localhost and the proxy would never
 * see the custom host. That silent drop is precisely the kind of thing that makes
 * a test pass while testing nothing.
 */
function requestWithHost(host: string, path = "/"): Promise<{ status: number; body: string }> {
  const url = new URL(BASE);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path,
        method: "GET",
        headers: { Host: host },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}
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

async function main() {
  const root = `njdesignpark-${Date.now()}.com`;
  const host = `review.${root}`;

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await login(
    ctx,
    process.env.SEED_TENANT_ADMIN_EMAIL!,
    process.env.SEED_TENANT_ADMIN_PASSWORD!,
    "/video/dashboard",
  );

  console.log("Connecting a domain");
  await page.goto(`${BASE}/video/dashboard/settings?tab=domain`, { waitUntil: "networkidle" });

  await page.fill("#rootDomain", root);
  const preview = await page.locator("text=review.").first().textContent();
  check(
    "settings previews review.<their domain>",
    (preview ?? "").includes("review."),
    `preview was "${preview}"`,
  );

  await page.click('form:has(#rootDomain) button[type="submit"]');
  await page.locator('form:has(#rootDomain) [role="status"]').first().waitFor({ timeout: 15000 });
  check("domain saved", true);

  const { data: saved } = await admin
    .from("tenants")
    .select("custom_domain, custom_domain_verified")
    .eq("slug", SLUG)
    .single();

  check("stores the FULL review host, not the root", saved?.custom_domain === host, `stored ${saved?.custom_domain}`);
  check(
    "a newly claimed domain is NOT verified",
    saved?.custom_domain_verified === false,
    "a tenant claimed a domain and it went live without any DNS check",
  );

  const body = await page.locator("body").innerText();
  // The VALUE is no longer asserted: it comes from the host's API now (Vercel issues
  // a per-project CNAME target), so pinning it to a literal is exactly the staleness
  // this change exists to remove. Assert the record's shape instead.
  check(
    "shows a CNAME record to add",
    body.includes("CNAME") && body.includes("review"),
  );
  check("shows an 'Awaiting DNS' state", body.includes("Awaiting DNS"));

  // ------------------------------------------------------------ THE BIG ONE
  console.log("\nBefore DNS is verified");
  const unverified = await fetch(`${BASE}/d/${host}`);
  check(
    "an UNVERIFIED domain serves NOTHING (404)",
    unverified.status === 404,
    `got HTTP ${unverified.status} — a tenant could serve content on a domain they don't own`,
  );

  const viaHost = await requestWithHost(host);
  check(
    "proxy routes an unverified custom host to a 404, not the app",
    viaHost.status === 404,
    `got HTTP ${viaHost.status}`,
  );

  // ------------------------------------------------------------ after DNS
  console.log("\nAfter DNS verifies");
  // Exactly what verifyCustomDomain() does once dns.resolveCname succeeds.
  await admin
    .from("tenants")
    .update({ custom_domain_verified: true })
    .eq("slug", SLUG);

  const verified = await fetch(`${BASE}/d/${host}`);
  check("a VERIFIED domain serves the tenant's page", verified.status === 200);

  // The ROOT of their domain is now the COLLECTION page, not the wall. That link is
  // what gets sent to a customer who was asked to record something -- showing them
  // other people's testimonials first is a step in the way.
  const html = await verified.text();
  check("the root is the collection page", html.includes("Record a video"));
  check("...branded to the tenant", html.includes("We Build Trades"));
  check("the collection page does NOT leak reviewer emails", !html.includes("@example.com"));

  // The wall still exists, one level down.
  const wall = await fetch(`${BASE}/d/${host}/reviews`);
  const wallHtml = await wall.text();
  check("/reviews serves the wall", wall.status === 200);
  check("the wall shows approved reviews", wallHtml.includes("Sarah Whitfield"));
  check("the wall does NOT show pending reviews", !wallHtml.includes("Priya Raman"));
  check("the wall does NOT leak reviewer emails", !wallHtml.includes("@example.com"));

  // And through the proxy, with a real Host header.
  const viaHostLive = await requestWithHost(host);
  check("proxy serves the tenant's page on their own host", viaHostLive.status === 200);
  check("...with the tenant's content", viaHostLive.body.includes("We Build Trades"));

  const wallViaHost = await requestWithHost(host, "/reviews");
  check("proxy serves the wall at /reviews on their host", wallViaHost.status === 200);
  check("...with their approved reviews", wallViaHost.body.includes("Sarah Whitfield"));

  // A host nobody claimed must not resolve to anything.
  const stranger = await requestWithHost("review.bbc.co.uk");
  check(
    "an unclaimed host serves nothing",
    stranger.status === 404,
    `got HTTP ${stranger.status}`,
  );

  // ---------------------------------------------------------------- cleanup
  await admin
    .from("tenants")
    .update({ custom_domain: null, custom_domain_verified: false })
    .eq("slug", SLUG);

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
