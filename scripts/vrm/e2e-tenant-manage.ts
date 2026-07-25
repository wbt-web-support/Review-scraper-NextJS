/**
 * Native tenant management from the scraper app, end to end.
 *
 * A business with video enabled is managed entirely through /api/business-urls/[id]/tenant/*,
 * under the NextAuth login -- no /video/* screens, no Supabase session. This proves the
 * management operations (bundle read, collection, branding+Mongo sync, video length, open
 * mode, API-key rotation, review moderation) all work and are ownership-guarded.
 *
 * Browser-free. Run against a dev server: npm run dev, then npm run verify:tenant-manage
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`); }
}

class Session {
  private cookies = new Map<string, string>();
  private store(res: Response) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";"); const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  private header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  async request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method, redirect: "manual",
      headers: { cookie: this.header(), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.store(res); return res;
  }
  async signIn(email: string, password: string) {
    const csrf = (await (await this.request("GET", "/api/auth/csrf")).json()) as { csrfToken: string };
    const form = new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${BASE}/reviews`, json: "true" });
    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST", redirect: "manual",
      headers: { cookie: this.header(), "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    this.store(res); return this.cookies.has("next-auth.session-token");
  }
}

const AGENCY = { username: "tenantmgrprobe", email: "tenantmgrprobe@webuildtrades.com", password: "ProbePassword123" };

async function main() {
  const stamp = Date.now();
  const session = new Session();
  const other = new Session();

  console.log("Setup");
  await session.request("POST", "/api/auth/register", { username: AGENCY.username, email: AGENCY.email, password: AGENCY.password, confirmPassword: AGENCY.password });
  check("agency signed in", await session.signIn(AGENCY.email, AGENCY.password));
  await other.request("POST", "/api/auth/register", { username: `other${stamp}`, email: `other+${stamp}@webuildtrades.com`, password: AGENCY.password, confirmPassword: AGENCY.password });
  await other.signIn(`other+${stamp}@webuildtrades.com`, AGENCY.password);

  // A business with video enabled.
  const created = await (await session.request("POST", "/api/business-urls", {
    name: `tenant mgr ${stamp}`, url: `https://maps.google.com/tm-${stamp}`, source: "google",
    contactEmail: `tm+${stamp}@webuildtrades.com`, brandColor: "#8A9A5B", adminPassword: "tm-probe-1234",
  })).json();
  check("business with video created", Boolean(created?.video?.tenantId));
  const bizPath = `/api/business-urls/${created._id}/tenant`;
  const tenantId = created.video.tenantId as string;

  // ------------------------------------------------ ownership guard
  console.log("\nOwnership guard");
  check("owner can read the bundle", (await session.request("GET", bizPath)).status === 200);
  check("a different user is refused (403)", (await other.request("GET", bizPath)).status === 403);
  check("logged-out is refused (401)", (await new Session().request("GET", bizPath)).status === 401);

  // ------------------------------------------------ bundle
  console.log("\nSettings bundle");
  const bundle = await (await session.request("GET", bizPath)).json();
  check("bundle has the tenant", bundle?.tenant?.id === tenantId);
  check("bundle has an api key", typeof bundle?.tenant?.api_key === "string" && bundle.tenant.api_key.startsWith("vrm_"));
  check("bundle has review counts", bundle?.counts && typeof bundle.counts.all === "number");
  check("bundle has default video length", bundle?.tenant?.max_video_seconds === 180);

  // ------------------------------------------------ collection page
  console.log("\nCollection page");
  const col = await session.request("PUT", `${bizPath}/settings`, {
    section: "collection", welcomeText: "Tell us how we did!", thankYouText: "Thanks a million.",
    promptQuestions: ["What did we fix?", "Would you recommend us?"],
  });
  check("collection saved", col.status === 200, `status ${col.status}`);
  const { data: cs } = await admin.from("collection_settings").select("welcome_text, prompt_questions").eq("tenant_id", tenantId).maybeSingle();
  check("welcome text persisted", cs?.welcome_text === "Tell us how we did!");
  check("prompt questions persisted", Array.isArray(cs?.prompt_questions) && cs!.prompt_questions.length === 2);

  // ------------------------------------------------ branding (+ Mongo sync)
  console.log("\nBranding");
  const br = await session.request("PUT", `${bizPath}/settings`, {
    section: "branding", name: `tenant mgr renamed ${stamp}`, brandColor: "#abcdef",
    logoUrl: "", contactEmail: `brand+${stamp}@webuildtrades.com`, contactPhone: "07700 222333",
  });
  check("branding saved", br.status === 200, `status ${br.status}`);
  const { data: tb } = await admin.from("tenants").select("name, brand_color, contact_phone").eq("id", tenantId).maybeSingle();
  check("tenant name updated", tb?.name === `tenant mgr renamed ${stamp}`, tb?.name);
  check("tenant brand colour updated", tb?.brand_color === "#abcdef");
  const listAfter = await (await session.request("GET", "/api/business-urls")).json();
  const bizAfter = (listAfter.businessUrls ?? []).find((b: { _id: string }) => b._id === created._id);
  check("Mongo business synced from branding", bizAfter?.name === `tenant mgr renamed ${stamp}` && bizAfter?.details?.brandColor === "#abcdef");

  // ------------------------------------------------ video length
  console.log("\nVideo length");
  check("valid length saved", (await session.request("PUT", `${bizPath}/settings`, { section: "videoLimit", maxVideoSeconds: 60 })).status === 200);
  const { data: tl } = await admin.from("tenants").select("max_video_seconds").eq("id", tenantId).maybeSingle();
  check("length persisted", tl?.max_video_seconds === 60);
  check("out-of-range length rejected", (await session.request("PUT", `${bizPath}/settings`, { section: "videoLimit", maxVideoSeconds: 99999 })).status === 400);

  // ------------------------------------------------ open mode
  console.log("\nReview open mode");
  check("open mode saved", (await session.request("PUT", `${bizPath}/settings`, { section: "openMode", mode: "page" })).status === 200);
  const { data: om } = await admin.from("tenants").select("review_open_mode").eq("id", tenantId).maybeSingle();
  check("open mode persisted", om?.review_open_mode === "page");

  // ------------------------------------------------ widget settings
  console.log("\nWidget settings");
  check("widget layout saved", (await session.request("PUT", `${bizPath}/settings`, { section: "widget", layout: "carousel", autoplay: true })).status === 200);
  const { data: ws2 } = await admin.from("widget_settings").select("layout, autoplay").eq("tenant_id", tenantId).maybeSingle();
  check("widget layout persisted", ws2?.layout === "carousel" && ws2?.autoplay === true);
  check("bundle reports widget settings", Boolean((await (await session.request("GET", bizPath)).json())?.widget));

  // ------------------------------------------------ api key rotation
  console.log("\nAPI key");
  const oldKey = bundle.tenant.api_key;
  const rot = await (await session.request("PUT", `${bizPath}/settings`, { section: "apiKey" })).json();
  check("rotate returns a new key", typeof rot?.apiKey === "string" && rot.apiKey.startsWith("vrm_") && rot.apiKey !== oldKey);
  const { data: ak } = await admin.from("tenants").select("api_key").eq("id", tenantId).maybeSingle();
  check("new key persisted", ak?.api_key === rot.apiKey);

  // ------------------------------------------------ review moderation
  console.log("\nReview moderation");
  // Seed a review directly in Postgres to moderate.
  const { data: seeded, error: seedErr } = await admin.from("reviews").insert({
    tenant_id: tenantId, reviewer_name: "Probe Customer", rating: 5, type: "text",
    text_review: "Great work", status: "pending", consent_given: true,
  }).select("id").single();
  check("a review exists to moderate", Boolean(seeded?.id), seedErr?.message);

  const listPending = await (await session.request("GET", `${bizPath}/reviews?status=pending`)).json();
  check("pending review is listed", (listPending.reviews ?? []).some((r: { id: string }) => r.id === seeded!.id));

  check("approve returns 200", (await session.request("PATCH", `${bizPath}/review`, { reviewId: seeded!.id, status: "approved" })).status === 200);
  const { data: approved } = await admin.from("reviews").select("status").eq("id", seeded!.id).maybeSingle();
  check("review is approved", approved?.status === "approved");

  check("a different user cannot moderate (403)", (await other.request("PATCH", `${bizPath}/review`, { reviewId: seeded!.id, status: "rejected" })).status === 403);

  check("delete returns 200", (await session.request("DELETE", `${bizPath}/review`, { reviewId: seeded!.id })).status === 200);
  const { data: gone } = await admin.from("reviews").select("id").eq("id", seeded!.id).maybeSingle();
  check("review is deleted", !gone);

  // ------------------------------------------------ cleanup
  await session.request("DELETE", `/api/business-urls/${created._id}`);
  check("tenant purged on business delete", !(await admin.from("tenants").select("id").eq("id", tenantId).maybeSingle()).data);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
