/**
 * Video reviews on a scraped business, end to end.
 *
 * Covers the /reviews-side flow: an agency user (NextAuth) adds a business AND
 * enables video reviews for it, or enables them on a business that already exists.
 * All of it provisions a real Supabase tenant, so this asserts against both Mongo
 * (via the API responses) and Postgres (directly).
 *
 * Browser-free -- see e2e-video-widget.ts for why. Run against a dev server:
 *   npm run dev, then npm run verify:business-video
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

class Session {
  private cookies = new Map<string, string>();
  private store(res: Response) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  private header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: "manual",
      headers: {
        cookie: this.header(),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.store(res);
    return res;
  }
  async signIn(email: string, password: string) {
    const csrf = (await (await this.request("GET", "/api/auth/csrf")).json()) as { csrfToken: string };
    const form = new URLSearchParams({
      csrfToken: csrf.csrfToken, email, password, callbackUrl: `${BASE}/reviews`, json: "true",
    });
    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST", redirect: "manual",
      headers: { cookie: this.header(), "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    this.store(res);
    return this.cookies.has("next-auth.session-token");
  }
}

const AGENCY = {
  username: "bizvideoprobe",
  email: "bizvideoprobe@webuildtrades.com",
  password: "ProbePassword123",
};

async function tenantById(id: string | undefined) {
  if (!id) return null;
  const { data } = await admin
    .from("tenants")
    .select("id, name, slug, embed_key")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function main() {
  const stamp = Date.now();
  const session = new Session();

  console.log("Agency login");
  await session.request("POST", "/api/auth/register", {
    username: AGENCY.username, email: AGENCY.email, password: AGENCY.password, confirmPassword: AGENCY.password,
  });
  check("agency user is signed in", await session.signIn(AGENCY.email, AGENCY.password));

  // ---------------------------------------------- add business WITH video
  console.log("\nAdding a business with video reviews in one go");
  const withVideo = await session.request("POST", "/api/business-urls", {
    name: `probe biz video ${stamp}`,
    url: `https://maps.google.com/probe-video-${stamp}`,
    source: "google",
    contactEmail: `biz-video+${stamp}@webuildtrades.com`,
    contactPhone: "07700 900123",
    brandColor: "#8A9A5B",
    adminPassword: "biz-probe-1234",
  });
  check("POST /api/business-urls returns 201", withVideo.status === 201, `status ${withVideo.status}`);
  const created = await withVideo.json();
  check("business carries a video link", Boolean(created?.video?.tenantId));

  const t1 = await tenantById(created?.video?.tenantId);
  check("a real tenant was provisioned", Boolean(t1));
  check("tenant slug matches the business link", t1?.slug === created?.video?.slug);
  // The STORED name is exactly what was typed -- title-casing is display only.
  check("stored tenant name is exactly what was typed", t1?.name === `probe biz video ${stamp}`, t1?.name);

  const feed1 = await session.request("GET", `/api/widget/${created?.video?.embedKey}`);
  check("the widget feed answers on the business's embed key", feed1.ok, `status ${feed1.status}`);
  const payload1 = await feed1.json().catch(() => null);
  // ...but the public feed reports it title-cased.
  check("the feed reports the name title-cased", payload1?.tenant?.name === `Probe Biz Video ${stamp}`, payload1?.tenant?.name);

  // ---------------------------------- add a scraping-only business (no video)
  console.log("\nAdding a scraping-only business (no video fields)");
  const plain = await session.request("POST", "/api/business-urls", {
    name: `probe biz plain ${stamp}`,
    url: `https://maps.google.com/probe-plain-${stamp}`,
    source: "google",
  });
  check("plain add still returns 201", plain.status === 201, `status ${plain.status}`);
  const plainBiz = await plain.json();
  check("...and has NO video link", !plainBiz?.video);

  // --------------------------------- enable video on the existing business
  console.log("\nEnabling video reviews on the existing business");
  const enable = await session.request("POST", `/api/business-urls/${plainBiz._id}/video`, {
    contactEmail: `biz-enable+${stamp}@webuildtrades.com`,
    brandColor: "#3B82F6",
    adminPassword: "biz-enable-1234",
  });
  check("enable returns 200", enable.status === 200, `status ${enable.status}`);
  const enabled = await enable.json();
  check("it returns a video link", Boolean(enabled?.video?.tenantId));

  const t2 = await tenantById(enabled?.video?.tenantId);
  check("a tenant was provisioned for the existing business", Boolean(t2));
  check("its name matches the business", t2?.name === `probe biz plain ${stamp}`, t2?.name);

  // enabling twice must not mint a second tenant
  const again = await session.request("POST", `/api/business-urls/${plainBiz._id}/video`, {
    contactEmail: `biz-again+${stamp}@webuildtrades.com`,
    brandColor: "#3B82F6",
    adminPassword: "biz-again-1234",
  });
  check("enabling video a second time is refused (409)", again.status === 409, `status ${again.status}`);

  // ------------------------------------------------ editing details
  console.log("\nEditing business details syncs to the tenant");
  const edit = await session.request("PUT", `/api/business-urls/${created._id}`, {
    name: `probe biz renamed ${stamp}`,
    firstName: "Jane",
    lastName: "Doe",
    email: `edited+${stamp}@webuildtrades.com`,
    phone: "07700 111222",
    brandColor: "#123456",
    logoUrl: "",
  });
  check("PUT returns 200", edit.status === 200, `status ${edit.status}`);

  const listAfterEdit = await (await session.request("GET", "/api/business-urls")).json();
  const editedBiz = (listAfterEdit.businessUrls ?? []).find((b: { _id: string }) => b._id === created._id);
  check("first/last name were stored", editedBiz?.details?.firstName === "Jane" && editedBiz?.details?.lastName === "Doe");
  check("the business name was updated", editedBiz?.name === `probe biz renamed ${stamp}`, editedBiz?.name);

  const { data: editedTenant } = await admin
    .from("tenants")
    .select("name, brand_color, contact_email, contact_phone")
    .eq("id", created?.video?.tenantId)
    .maybeSingle();
  check("the tenant name synced", editedTenant?.name === `probe biz renamed ${stamp}`, editedTenant?.name);
  check("the tenant brand colour synced", editedTenant?.brand_color === "#123456", editedTenant?.brand_color);
  check("the tenant contact email synced", editedTenant?.contact_email === `edited+${stamp}@webuildtrades.com`);
  check("the tenant phone synced", editedTenant?.contact_phone === "07700 111222");

  const feedAfterEdit = await (await session.request("GET", `/api/widget/${created?.video?.embedKey}`)).json();
  check("the feed shows the renamed, title-cased business", feedAfterEdit?.tenant?.name === `Probe Biz Renamed ${stamp}`, feedAfterEdit?.tenant?.name);

  // ------------------------------------ duplicate email leaves no orphan
  console.log("\nA duplicate login email is rejected cleanly");
  const { count: before } = await admin.from("tenants").select("id", { count: "exact", head: true });
  const dupe = await session.request("POST", "/api/business-urls", {
    name: `probe biz dupe ${stamp}`,
    url: `https://maps.google.com/probe-dupe-${stamp}`,
    source: "google",
    contactEmail: `biz-video+${stamp}@webuildtrades.com`, // already used above
    brandColor: "#8A9A5B",
    adminPassword: "biz-dupe-1234",
  });
  check("duplicate email is rejected", dupe.status === 400, `status ${dupe.status}`);
  const { count: after } = await admin.from("tenants").select("id", { count: "exact", head: true });
  check("...and no orphan tenant was left behind", before === after, `${before} -> ${after}`);
  // the business row must have been rolled back too
  const listRes = await session.request("GET", "/api/business-urls");
  const list = await listRes.json();
  const names = (list.businessUrls ?? []).map((b: { name: string }) => b.name);
  check("...and no orphan business row either", !names.includes(`probe biz dupe ${stamp}`));

  // ------------------------------------------- delete purges the tenant
  console.log("\nDeleting a business tears its tenant down");
  const del = await session.request("DELETE", `/api/business-urls/${created._id}`);
  check("delete returns 200", del.ok, `status ${del.status}`);
  check("the tenant is gone too", !(await tenantById(created?.video?.tenantId)));

  // clean up the second business + its tenant
  await session.request("DELETE", `/api/business-urls/${plainBiz._id}`);
  check("the enabled tenant is gone after its business is deleted", !(await tenantById(enabled?.video?.tenantId)));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
