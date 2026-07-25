/**
 * Video review, end to end, against whichever provider is configured.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-video.ts [baseUrl]
 *
 * Drives the real collection page in a real browser with a FAKE CAMERA (Chromium
 * plays a generated video into getUserMedia), so MediaRecorder, the provider
 * hand-off, and the direct-to-storage upload all actually run.
 *
 * Then proves the video is playable, reaches moderation, and only reaches the
 * public widget once approved.
 */
import { chromium, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SLUG = process.env.SEED_TENANT_SLUG ?? "webuildtrades";
const USING_BUNNY = Boolean(
  process.env.BUNNY_STREAM_LIBRARY_ID &&
    process.env.BUNNY_STREAM_API_KEY &&
    process.env.BUNNY_CDN_HOSTNAME,
);

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
  const reviewerName = `Video Probe ${stamp}`;

  console.log(`Provider: ${USING_BUNNY ? "Bunny Stream" : "Supabase Storage (fallback)"}\n`);

  const browser = await chromium.launch({
    args: [
      // Chromium synthesises a camera+mic, so getUserMedia and MediaRecorder run
      // for real rather than being stubbed out.
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

  // ---------------------------------------------------------------- record
  console.log("Recording");
  await page.goto(`${BASE}/c/${SLUG}`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Record a video")');

  await page.click('button:has-text("Turn on camera")');
  await page.waitForSelector('button:has-text("Start recording")', { timeout: 20000 });
  check("camera preview starts", true);

  await page.click('button:has-text("Start recording")');
  await page.waitForTimeout(3000); // ~3 seconds of video
  await page.click('button:has-text("Stop")');

  await page.waitForSelector('button:has-text("Re-record")', { timeout: 20000 });
  check("recording stops and offers a retake", true);

  // The recorder now owns the preview: save the recorded video to advance.
  await page.click('button:has-text("Save video")');

  // --------------------------------------------------------------- details
  await page.fill("#name", reviewerName);
  await page.click('button[aria-label="5 stars"]');
  await page.check("#consent");

  console.log("\nUploading");
  await page.click('button:has-text("Submit review")');

  // The thank-you screen only appears AFTER the upload resolves, so reaching it
  // is itself proof the upload succeeded.
  await page.waitForSelector("text=Thank you", { timeout: 90000 });
  check("upload completed and thank-you shown", true);
  check("no client-side errors during record/upload", errors.length === 0, errors.slice(0, 2).join(" | "));

  // ------------------------------------------------------------------ row
  const { data: review } = await admin
    .from("reviews")
    .select("id, type, status, video_guid, video_url, consent_given, tenant_id")
    .eq("reviewer_name", reviewerName)
    .maybeSingle();

  check("review row created", Boolean(review));
  check("type is video", review?.type === "video");
  check("status is PENDING (never auto-published)", review?.status === "pending");
  check("video_guid recorded", Boolean(review?.video_guid));

  if (!USING_BUNNY) {
    check(
      "video_url points at Supabase Storage",
      Boolean(review?.video_url?.includes("/storage/v1/object/public/review-videos/")),
      `got ${review?.video_url}`,
    );
    check(
      "storage path is namespaced by tenant (no cross-tenant writes)",
      Boolean(review?.video_guid?.startsWith(`${review?.tenant_id}/`)),
      `path was ${review?.video_guid}`,
    );

    // The bytes really landed.
    const head = await fetch(review!.video_url!, { method: "HEAD" });
    const size = Number(head.headers.get("content-length") ?? 0);
    check("the video file is publicly fetchable", head.ok, `HTTP ${head.status}`);
    check("the file is not empty", size > 1000, `${size} bytes`);
    console.log(`        (${(size / 1024).toFixed(0)} KB, ${head.headers.get("content-type")})`);
  } else {
    check("video_url is null until Bunny's encode webhook fires", review?.video_url === null);
  }

  // ----------------------------------------------------------- moderation
  console.log("\nModeration");
  const tenantCtx = await browser.newContext();
  const dash = await login(
    tenantCtx,
    process.env.SEED_TENANT_ADMIN_EMAIL!,
    process.env.SEED_TENANT_ADMIN_PASSWORD!,
    "/video/dashboard",
  );
  await dash.goto(`${BASE}/video/dashboard`, { waitUntil: "networkidle" });

  const card = dash.locator("article").filter({ hasText: reviewerName });
  check("video review appears in the pending queue", await card.isVisible());

  if (!USING_BUNNY) {
    const hasVideoEl = await card.locator("video").count();
    check("dashboard renders a playable <video> element", hasVideoEl > 0);
  }

  // Public feed must NOT contain it yet.
  const { data: tenant } = await admin
    .from("tenants")
    .select("embed_key")
    .eq("slug", SLUG)
    .single();

  let feed = await (await fetch(`${BASE}/api/widget/${tenant!.embed_key}`)).json();
  check(
    "a PENDING video does NOT reach the public widget",
    !JSON.stringify(feed.reviews).includes(reviewerName),
  );

  await card.locator('button:has-text("Approve")').click();
  await dash.waitForLoadState("networkidle");

  let status: string | undefined;
  for (let i = 0; i < 20; i++) {
    const { data } = await admin.from("reviews").select("status").eq("id", review!.id).single();
    status = data?.status;
    if (status === "approved") break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check("approve works on a video review", status === "approved");

  // ------------------------------------------------------------- publish
  console.log("\nPublishing");
  // s-maxage is a CDN hint; the dev server does not cache, so this is immediate.
  feed = await (await fetch(`${BASE}/api/widget/${tenant!.embed_key}`)).json();
  const published = feed.reviews.find(
    (r: { reviewer_name: string }) => r.reviewer_name === reviewerName,
  );
  check("approved video reaches the public widget", Boolean(published));
  check("widget payload carries a playable video_url", Boolean(published?.video_url) || USING_BUNNY);
  check(
    "widget payload still carries NO reviewer PII",
    !JSON.stringify(feed).includes("reviewer_email"),
  );

  // And it actually plays in the widget on a third-party page.
  const embedPage = await (await browser.newContext()).newPage();
  await embedPage.goto(`${BASE}/widget-demo.html`, { waitUntil: "networkidle" });
  await embedPage.evaluate((key) => {
    document.querySelectorAll("script[data-tenant]").forEach((el) => el.remove());
    document.querySelectorAll("div").forEach((d) => {
      if (d.shadowRoot) d.remove();
    });
    const s = document.createElement("script");
    s.src = "/w.js";
    s.setAttribute("data-tenant", key);
    document.querySelector(".page")!.appendChild(s);
  }, tenant!.embed_key);

  await embedPage
    .waitForFunction(
      () =>
        Array.from(document.querySelectorAll("div")).some((d) =>
          d.shadowRoot?.querySelector(".media"),
        ),
      { timeout: 15000 },
    )
    .catch(() => {});

  const widgetVideo = await embedPage.evaluate(() => {
    const host = Array.from(document.querySelectorAll("div")).find((d) =>
      d.shadowRoot?.querySelector(".media"),
    );
    const button = host?.shadowRoot?.querySelector(".media") as HTMLElement | undefined;
    if (!button) return null;
    button.click(); // click-to-play
    return { hasButton: true };
  });
  check("widget shows a click-to-play video thumbnail", Boolean(widgetVideo));

  await embedPage.waitForTimeout(1500);
  const playing = await embedPage.evaluate(() => {
    const host = Array.from(document.querySelectorAll("div")).find((d) =>
      d.shadowRoot?.querySelector(".media"),
    );
    const root = host?.shadowRoot;
    return {
      video: Boolean(root?.querySelector(".media video")),
      iframe: Boolean(root?.querySelector(".media iframe")),
    };
  });
  check(
    "clicking play swaps in a real player",
    USING_BUNNY ? playing.iframe : playing.video,
    JSON.stringify(playing),
  );

  // ------------------------------------------------------------- cleanup
  if (!USING_BUNNY && review?.video_guid) {
    await admin.storage.from("review-videos").remove([review.video_guid]);
  }
  await admin.from("reviews").delete().eq("id", review!.id);

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
