/**
 * The Video Reviews widget, end to end.
 *
 * This is the seam between the two halves of the app: an agency user authenticated
 * by NextAuth (Mongo) provisions a tenant in Supabase. Neither existing suite covers
 * it -- the video app's suites all authenticate through Supabase, and the scraper has
 * none. So it gets its own.
 *
 * What it proves:
 *   - creating the widget provisions a REAL tenant: row, settings, embed key, login
 *   - the Mongo widget and the Supabase tenant agree on slug and embed key
 *   - the public widget feed answers on that embed key
 *   - a duplicate email is rejected AND leaves no orphan tenant behind
 *   - deleting the widget tears the tenant down with it
 *
 * Run against a dev server: npm run dev, then npm run verify:video-widget
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * A cookie jar over fetch. This test used to drive a real browser for the login, but
 * Chromium launch is the flakiest thing on a loaded machine and none of what we are
 * checking needs a rendered page -- it is all API calls and database assertions. So
 * we do the NextAuth credentials handshake over plain HTTP instead: get a CSRF token,
 * post it with the credentials, keep the session cookie.
 */
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

  /** NextAuth credentials sign-in, entirely over HTTP. */
  async signIn(email: string, password: string) {
    const csrfRes = await this.request("GET", "/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    const form = new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/widgets`,
      json: "true",
    });
    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: this.header(), "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    this.store(res);
    return this.cookies.has("next-auth.session-token");
  }
}

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

/** A scraper account to act as. Registers on first run, reuses it afterwards. */
const AGENCY = {
  username: "videowidgetprobe",
  email: "videowidgetprobe@webuildtrades.com",
  password: "ProbePassword123",
};

async function signInAsAgency(session: Session) {
  // Idempotent: a second run just gets "already registered", which is fine.
  await session.request("POST", "/api/auth/register", {
    username: AGENCY.username,
    email: AGENCY.email,
    password: AGENCY.password,
    confirmPassword: AGENCY.password,
  });
  return session.signIn(AGENCY.email, AGENCY.password);
}

async function main() {
  const stamp = Date.now();
  const businessName = `probe video ${stamp}`; // lowercase on purpose -- see title-case check
  const ownerEmail = `probe-video+${stamp}@webuildtrades.com`;

  const session = new Session();

  console.log("Agency login (NextAuth)");
  const signedIn = await signInAsAgency(session);
  check("agency user is signed in to the scraper", signedIn);

  // ------------------------------------------------------------------ create
  console.log("\nCreating a Video Reviews widget");
  const createRes = await session.request("POST", "/api/widgets", {
    type: "video",
    layout: "video",
    name: businessName,
    contactEmail: ownerEmail,
    contactPhone: "07700 900123",
    brandColor: "#8A9A5B",
    rootDomain: "",
    logoUrl: "",
    adminPassword: "probe-tenant-1234",
  });
  check("POST /api/widgets returns 201", createRes.status === 201, `got ${createRes.status}`);

  const widget = await createRes.json();
  check("widget is stored with type 'video'", widget?.type === "video", JSON.stringify(widget?.type));
  check("widget carries the tenant link", Boolean(widget?.video?.tenantId));
  check("widget has NO business URL", !widget?.businessUrlId);
  check(
    "collection URL points at the tenant's slug",
    typeof widget?.video?.collectUrl === "string" &&
      widget.video.collectUrl.endsWith(`/c/${widget.video.slug}`),
    widget?.video?.collectUrl,
  );

  // --------------------------------------------------------- supabase side
  console.log("\nThe tenant it provisioned");
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug, subdomain, embed_key, brand_color, contact_email")
    .eq("id", widget?.video?.tenantId ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  check("a real tenant row exists", Boolean(tenant));
  check("slug agrees with the widget", tenant?.slug === widget?.video?.slug);
  check("embed key agrees with the widget", tenant?.embed_key === widget?.video?.embedKey);
  check("subdomain matches the slug", tenant?.subdomain === tenant?.slug);
  check("brand colour was applied", tenant?.brand_color === "#8A9A5B");
  check("the stored name is EXACTLY what was typed", tenant?.name === businessName, tenant?.name);

  const { data: cs } = await admin
    .from("collection_settings")
    .select("tenant_id, welcome_text")
    .eq("tenant_id", tenant?.id)
    .maybeSingle();
  check("collection settings were seeded", Boolean(cs));
  check(
    "the generated welcome text is title-cased",
    typeof cs?.welcome_text === "string" && cs.welcome_text.includes("Probe Video"),
    cs?.welcome_text,
  );

  const { data: ws } = await admin
    .from("widget_settings")
    .select("tenant_id")
    .eq("tenant_id", tenant?.id)
    .maybeSingle();
  check("widget settings were seeded", Boolean(ws));

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, role, tenant_id")
    .eq("tenant_id", tenant?.id);
  check("the owner's login was created", (profiles ?? []).length === 1);
  check("the owner is a tenant_admin", profiles?.[0]?.role === "tenant_admin");
  check("the owner's email is the one given", profiles?.[0]?.email === ownerEmail);

  // ------------------------------------------------------------ public feed
  console.log("\nThe public widget feed");
  const feed = await session.request("GET", `/api/widget/${widget?.video?.embedKey}`);
  check("feed answers on the embed key", feed.ok, `status ${feed.status}`);
  const payload = await feed.json().catch(() => null);
  check(
    "feed reports the tenant name title-cased",
    payload?.tenant?.name === "Probe Video " + stamp,
    payload?.tenant?.name,
  );
  check("feed has no reviews yet", Array.isArray(payload?.reviews) && payload.reviews.length === 0);

  // The scraper's own feed must refuse it rather than return an empty widget.
  const wrongFeed = await session.request("GET", `/api/public/widget-data/${widget?._id}`);
  check("the scraper's feed rejects a video widget", wrongFeed.status === 400, `status ${wrongFeed.status}`);

  // ------------------------------------------------------------- collection
  const collect = await session.request("GET", `/c/${widget?.video?.slug}`);
  check("the collection page is live", collect.ok, `status ${collect.status}`);
  const html = await collect.text();
  check("...and shows the business title-cased", html.includes("Probe Video"), "not found in page");
  check("...and does NOT show it lowercased", !html.includes(">probe video"), "lowercase leaked");

  // ------------------------------------------------------- duplicate email
  console.log("\nRejecting a duplicate login email");
  const { count: before } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true });

  const dupe = await session.request("POST", "/api/widgets", {
    type: "video",
    layout: "video",
    name: `probe dupe ${stamp}`,
    contactEmail: ownerEmail, // already taken by the tenant above
    brandColor: "#8A9A5B",
    adminPassword: "probe-tenant-1234",
  });
  check("a duplicate email is rejected", dupe.status === 400, `status ${dupe.status}`);

  const { count: after } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true });
  check("...and leaves NO orphan tenant behind", before === after, `${before} -> ${after}`);

  // ----------------------------------------------------------------- delete
  console.log("\nDeleting the widget");
  const del = await session.request("DELETE", `/api/widgets/${widget?._id}`);
  check("delete returns 200", del.ok, `status ${del.status}`);

  const { data: goneTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("id", tenant?.id)
    .maybeSingle();
  check("the tenant is gone too", !goneTenant);

  const { data: goneProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenant?.id);
  check("the owner's login went with it (no orphan users)", (goneProfiles ?? []).length === 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
