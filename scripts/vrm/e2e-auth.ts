/**
 * End-to-end auth check against a running dev server.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-auth.ts [baseUrl]
 *
 * Signs in for real, builds the session cookie exactly as @supabase/ssr does,
 * and exercises every route as each role. Redirects are NOT followed -- we assert
 * on the Location header, which is what actually proves the routing rules.
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const projectRef = new URL(url).hostname.split(".")[0];

let passed = 0;
let failed = 0;

function check(name: string, actual: string, expected: string) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}\n        expected ${expected}\n        got      ${actual}`);
  }
}

/**
 * @supabase/ssr stores the session as base64-encoded JSON, split across numbered
 * cookies once it exceeds the chunk size. Mirror that exactly.
 */
function sessionCookies(session: unknown): string {
  const name = `sb-${projectRef}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");

  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${encodeURIComponent(value)}`;

  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += MAX) chunks.push(value.slice(i, i + MAX));
  return chunks.map((c, i) => `${name}.${i}=${encodeURIComponent(c)}`).join("; ");
}

async function visit(path: string, cookie?: string) {
  const res = await fetch(BASE + path, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  const location = res.headers.get("location");
  if (location) {
    // Normalize to a path so assertions don't depend on host/port.
    const p = location.startsWith("http") ? new URL(location).pathname : location;
    return `${res.status} -> ${p}`;
  }
  return `${res.status}`;
}

async function signIn(email: string, password: string) {
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return sessionCookies(data.session);
}

async function main() {
  console.log(`Testing ${BASE}\n`);

  console.log("Logged out");
  // "/" now belongs to the review scraper. The video app's role-router is /video.
  check("/video      redirects to /login", await visit("/video"), "307 -> /video/login");
  check("/video/dashboard  redirects to /login", await visit("/video/dashboard"), "307 -> /video/login");
  check("/video/admin      redirects to /login", await visit("/video/admin"), "307 -> /video/login");
  check("/video/login      renders", await visit("/video/login"), "200");

  console.log("\nsuper_admin (test@webuildtrades.com)");
  const superCookie = await signIn(
    process.env.SEED_SUPER_ADMIN_EMAIL!,
    process.env.SEED_SUPER_ADMIN_PASSWORD!,
  );
  check("/video/admin      renders", await visit("/video/admin", superCookie), "200");
  check("/video      redirects to /admin", await visit("/video", superCookie), "307 -> /video/admin");
  check("/video/login      redirects to /admin", await visit("/video/login", superCookie), "307 -> /video/admin");
  check(
    "/video/dashboard  redirects to /admin (wrong role)",
    await visit("/video/dashboard", superCookie),
    "307 -> /video/admin",
  );

  console.log("\ntenant_admin (user@webuildtrades.com)");
  const tenantCookie = await signIn(
    process.env.SEED_TENANT_ADMIN_EMAIL!,
    process.env.SEED_TENANT_ADMIN_PASSWORD!,
  );
  check("/video/dashboard  renders", await visit("/video/dashboard", tenantCookie), "200");
  check("/video      redirects to /dashboard", await visit("/video", tenantCookie), "307 -> /video/dashboard");
  check("/video/login      redirects to /dashboard", await visit("/video/login", tenantCookie), "307 -> /video/dashboard");
  check(
    "/video/admin      redirects to /dashboard (wrong role)",
    await visit("/video/admin", tenantCookie),
    "307 -> /video/dashboard",
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
