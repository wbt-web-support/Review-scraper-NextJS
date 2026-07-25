/**
 * End-to-end for Phases 3-6: collection page -> moderation -> widget/subdomain.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-phases-3-6.ts [baseUrl]
 *
 * Drives the real UI in a browser and probes the public APIs directly for the
 * things a browser cannot show you -- notably that reviewer PII never leaves the
 * building, and that a client cannot smuggle in its own tenant_id or status.
 *
 * The video path is NOT covered: it needs live Bunny credentials. Everything else
 * is real.
 */
import { chromium, type BrowserContext } from "playwright";
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

async function main() {
  const stamp = Date.now();
  const reviewerName = `Probe Reviewer ${stamp}`;
  const reviewerEmail = `probe+${stamp}@example.com`;

  const browser = await chromium.launch();

  // ============================================================ PHASE 3
  console.log("Phase 3 — public collection page");

  const publicCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await publicCtx.newPage();
  await page.goto(`${BASE}/c/${SLUG}`, { waitUntil: "networkidle" });

  check("collection page renders for a valid slug", page.url().includes(`/c/${SLUG}`));
  const intro = await page.locator("body").innerText();
  check("shows the tenant's configured prompt questions", intro.includes("What problem were you trying to solve?"));

  const missing = await fetch(`${BASE}/c/does-not-exist-${stamp}`);
  check("unknown slug 404s", missing.status === 404, `status ${missing.status}`);

  // --- text review through the real UI
  await page.goto(`${BASE}/c/${SLUG}`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Write a review instead")');
  await page.fill("textarea", "The team turned up on time and the work was spotless.");
  await page.click('button:has-text("Continue")');

  await page.fill("#name", reviewerName);
  await page.fill("#email", reviewerEmail);
  await page.click('button[aria-label="5 stars"]');

  // Submit WITHOUT ticking consent -- GDPR says this must be refused.
  await page.click('button:has-text("Submit review")');
  await page.waitForSelector('[role="alert"]', { timeout: 5000 }).catch(() => {});
  const consentErr = await page.locator('[role="alert"]').first().textContent().catch(() => "");
  check("submitting without consent is refused", (consentErr ?? "").toLowerCase().includes("consent"), `got "${consentErr}"`);

  await page.check("#consent");
  await page.click('button:has-text("Submit review")');
  await page.waitForSelector("text=Thank you", { timeout: 15000 });
  check("thank-you screen shown after submit", (await page.locator("body").innerText()).includes("Thank you"));

  // --- it must land as PENDING, never auto-published
  const { data: created } = await admin
    .from("reviews")
    .select("id, status, consent_given, rating, reviewer_email, tenant_id")
    .eq("reviewer_name", reviewerName)
    .maybeSingle();

  check("review was created", Boolean(created));
  check("review defaults to PENDING (never auto-published)", created?.status === "pending");
  check("consent_given recorded true", created?.consent_given === true);
  check("rating captured", created?.rating === 5);

  // --- API-level abuse: the client must not be able to name a tenant or a status
  const { data: otherTenant } = await admin
    .from("tenants")
    .select("id")
    .neq("slug", SLUG)
    .limit(1)
    .maybeSingle();

  const injected = await fetch(`${BASE}/api/collect/${SLUG}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "text",
      reviewerName: `Injection ${stamp}`,
      rating: 5,
      consentGiven: true,
      textReview: "injected",
      // Both of these are hostile. Neither exists in the schema.
      tenant_id: otherTenant?.id ?? "00000000-0000-4000-8000-000000000000",
      status: "approved",
    }),
  });
  const injectedOk = injected.ok;
  const { data: injectedRow } = await admin
    .from("reviews")
    .select("status, tenant_id")
    .eq("reviewer_name", `Injection ${stamp}`)
    .maybeSingle();

  check(
    "client-supplied status='approved' is ignored (still pending)",
    injectedOk && injectedRow?.status === "pending",
    `status was ${injectedRow?.status}`,
  );
  check(
    "client-supplied tenant_id is ignored (tenant comes from the slug)",
    injectedRow?.tenant_id === created?.tenant_id,
    "a review was planted in another tenant",
  );

  const noConsent = await fetch(`${BASE}/api/collect/${SLUG}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "text",
      reviewerName: "No Consent",
      rating: 5,
      consentGiven: false,
      textReview: "x",
    }),
  });
  check("API rejects consentGiven=false", noConsent.status === 400);

  await publicCtx.close();

  // ============================================================ PHASE 4
  console.log("\nPhase 4 — moderation");

  const tenantCtx = await browser.newContext();
  const dash = await login(
    tenantCtx,
    process.env.SEED_TENANT_ADMIN_EMAIL!,
    process.env.SEED_TENANT_ADMIN_PASSWORD!,
    "/video/dashboard",
  );

  await dash.goto(`${BASE}/video/dashboard`, { waitUntil: "networkidle" });
  const queue = await dash.locator("body").innerText();
  check("new review appears in the Pending queue", queue.includes(reviewerName));

  // Approve it.
  const card = dash.locator("article").filter({ hasText: reviewerName });
  await card.locator('button:has-text("Approve")').click();
  await dash.waitForLoadState("networkidle");

  // Poll: the server action, its revalidate, and the client navigation all settle
  // asynchronously, so reading the DB immediately after the click is a race.
  let approvedStatus: string | undefined;
  for (let i = 0; i < 20; i++) {
    const { data } = await admin.from("reviews").select("status").eq("id", created!.id).single();
    approvedStatus = data?.status;
    if (approvedStatus === "approved") break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check("approve sets status=approved", approvedStatus === "approved", `status was ${approvedStatus}`);

  await dash.goto(`${BASE}/video/dashboard?status=approved`, { waitUntil: "networkidle" });
  check(
    "approved tab shows it",
    (await dash.locator("body").innerText()).includes(reviewerName),
  );

  // Settings page loads and can save.
  await dash.goto(`${BASE}/video/dashboard/settings`, { waitUntil: "networkidle" });
  check("settings page renders", (await dash.locator("h1").textContent()) === "Settings");

  // Settings is tabbed now; the embed snippet lives on the widget tab.
  await dash.goto(`${BASE}/video/dashboard/settings?tab=widget`, { waitUntil: "networkidle" });
  check(
    "settings shows the embed snippet",
    (await dash.locator("body").innerText()).includes("data-tenant="),
  );
  await tenantCtx.close();

  // ============================================================ PHASE 5
  console.log("\nPhase 5 — public widget API + embed");

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("embed_key, subdomain")
    .eq("slug", SLUG)
    .single();

  const widgetRes = await fetch(`${BASE}/api/widget/${tenantRow!.embed_key}`);
  const widget = await widgetRes.json();

  check("widget API returns 200", widgetRes.ok);
  check("CORS is open (widget lives on third-party sites)", widgetRes.headers.get("access-control-allow-origin") === "*");
  check(
    "response is CDN-cached",
    (widgetRes.headers.get("cache-control") ?? "").includes("s-maxage"),
  );
  check("approved review is in the feed", widget.reviews.some((r: { reviewer_name: string }) => r.reviewer_name === reviewerName));
  // The injected row is still pending, so it must not appear in a public feed.
  check(
    "ONLY approved reviews are served",
    !JSON.stringify(widget.reviews).includes("Injection "),
    "a pending review leaked into the public feed",
  );

  // The whole reason anon has no table access.
  const payloadText = JSON.stringify(widget);
  check(
    "reviewer_email (PII) is NOT in the public payload",
    !payloadText.includes(reviewerEmail) && !payloadText.includes("reviewer_email"),
    "customer PII is being served to the open internet",
  );
  check("transcript is NOT in the public payload", !payloadText.includes("transcript"));
  check("tenant_id is NOT in the public payload", !payloadText.includes("tenant_id"));

  const bogus = await fetch(`${BASE}/api/widget/not-a-real-key-${stamp}`);
  check("unknown embed key 404s", bogus.status === 404);

  // --- the widget actually rendering on a hostile third-party page
  const embedCtx = await browser.newContext();
  const embedPage = await embedCtx.newPage();
  await embedPage.goto(`${BASE}/widget-demo.html`, { waitUntil: "networkidle" });

  // widget-demo.html ships a placeholder data-tenant="EMBED_KEY" which 404s and
  // leaves behind an EMPTY shadow host. Remove it, or we end up measuring that one.
  await embedPage.evaluate((key) => {
    document.querySelectorAll("script[data-tenant]").forEach((el) => el.remove());
    document.querySelectorAll("div").forEach((d) => {
      if (d.shadowRoot) d.remove();
    });
    const s = document.createElement("script");
    s.src = "/w.js";
    s.setAttribute("data-tenant", key);
    document.querySelector(".page")!.appendChild(s);
  }, tenantRow!.embed_key);

  await embedPage
    .waitForFunction(
      () =>
        Array.from(document.querySelectorAll("div")).some((d) =>
          d.shadowRoot?.querySelector(".card"),
        ),
      { timeout: 15000 },
    )
    .catch(() => {});

  const shadowInfo = await embedPage.evaluate(() => {
    const host = Array.from(document.querySelectorAll("div")).find((d) =>
      d.shadowRoot?.querySelector(".card"),
    );
    const root = host?.shadowRoot;
    if (!root) return null;
    const card = root.querySelector(".card")!;
    return {
      cards: root.querySelectorAll(".card").length,
      // If the host page's `article { background: hotpink }` bled through, the
      // shadow boundary is not doing its job.
      cardBg: getComputedStyle(card).backgroundColor,
      cardFont: getComputedStyle(card).fontFamily,
      text: root.textContent ?? "",
    };
  });

  check("widget mounts in a shadow root", Boolean(shadowInfo));
  check("widget renders review cards", (shadowInfo?.cards ?? 0) > 0, `cards: ${shadowInfo?.cards}`);
  check(
    "host page CSS cannot break the widget (article{background:hotpink} blocked)",
    shadowInfo?.cardBg === "rgb(255, 255, 255)",
    `card background was ${shadowInfo?.cardBg}`,
  );
  check(
    "host page font (Comic Sans) does not leak in",
    !(shadowInfo?.cardFont ?? "").toLowerCase().includes("comic"),
    `font was ${shadowInfo?.cardFont}`,
  );
  check("widget shows the approved review", (shadowInfo?.text ?? "").includes(reviewerName));
  check(
    "widget does NOT show pending reviews",
    !(shadowInfo?.text ?? "").includes("Injection "),
  );

  // --- the widget must survive being pasted anywhere.
  //
  // The <head> case is the one that actually bit us: the naive "insert after the
  // script tag" mounted the widget INSIDE <head>, which renders nothing at all,
  // silently. And <head> is exactly where most people paste a script.
  const placements: [string, string][] = [
    ["script in <body>", `<!doctype html><html><body><h1>Site</h1>{S}</body></html>`],
    ["script in <head>", `<!doctype html><html><head>{S}</head><body><h1>Site</h1></body></html>`],
    [
      "data-target div",
      `<!doctype html><html><head>{S}</head><body><div id="reviews-widget"></div></body></html>`,
    ],
  ];

  for (const [label, template] of placements) {
    const target = label === "data-target div" ? ' data-target="reviews-widget"' : "";
    const tag = `<script src="${BASE}/w.js" data-tenant="${tenantRow!.embed_key}"${target} async></script>`;
    const page2 = await embedCtx.newPage();
    await page2.setContent(template.replace("{S}", tag), { waitUntil: "load" });
    await page2.waitForTimeout(2000);

    const mounted = await page2.evaluate(() => {
      const host = Array.from(document.querySelectorAll("div")).find((d) => d.shadowRoot);
      if (!host) return null;
      return {
        cards: host.shadowRoot!.querySelectorAll(".card").length,
        visible: document.body.contains(host),
      };
    });

    check(
      `widget renders and is VISIBLE with the ${label}`,
      (mounted?.cards ?? 0) > 0 && mounted?.visible === true,
      `cards=${mounted?.cards} visible=${mounted?.visible}`,
    );
    await page2.close();
  }

  // data-layout must actually change the layout.
  const layoutPage = await embedCtx.newPage();
  await layoutPage.setContent(
    `<!doctype html><html><body><script src="${BASE}/w.js" data-tenant="${tenantRow!.embed_key}" data-layout="carousel" async></script></body></html>`,
    { waitUntil: "load" },
  );
  await layoutPage.waitForTimeout(2000);
  const layoutCls = await layoutPage.evaluate(() => {
    const host = Array.from(document.querySelectorAll("div")).find((d) => d.shadowRoot);
    return host?.shadowRoot?.querySelector("div > div")?.className ?? null;
  });
  check('data-layout="carousel" renders the carousel', layoutCls === "rail", `class was "${layoutCls}"`);
  await layoutPage.close();

  await embedCtx.close();

  // ============================================================ PHASE 6
  console.log("\nPhase 6 — subdomain page");

  const subCtx = await browser.newContext();
  const subPage = await subCtx.newPage();
  await subPage.goto(`${BASE}/s/${tenantRow!.subdomain}`, { waitUntil: "networkidle" });
  const subText = await subPage.locator("body").innerText();

  check("subdomain page renders", subText.includes("What customers say about"));
  check("shows the approved review", subText.includes(reviewerName));
  check("does NOT show pending reviews", !subText.includes("Injection "));
  check("does NOT show reviewer emails", !subText.includes(reviewerEmail));
  await subCtx.close();

  // ============================================================ cleanup
  await admin.from("reviews").delete().eq("reviewer_name", reviewerName);
  await admin.from("reviews").delete().eq("reviewer_name", `Injection ${stamp}`);

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
