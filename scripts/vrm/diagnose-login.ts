/**
 * Signs in as each seeded account against the real Supabase API and decodes the
 * returned JWT. Distinguishes "wrong password" from "password fine, but the auth
 * hook isn't injecting claims" -- which present identically as a failed login.
 *
 *   npx tsx --env-file=.env.local scripts/diagnose-login.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const accounts = [
  {
    label: "super_admin",
    email: process.env.SEED_SUPER_ADMIN_EMAIL!,
    password: process.env.SEED_SUPER_ADMIN_PASSWORD!,
  },
  {
    label: "tenant_admin",
    email: process.env.SEED_TENANT_ADMIN_EMAIL!,
    password: process.env.SEED_TENANT_ADMIN_PASSWORD!,
  },
];

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("=== auth.users ===");
  const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  for (const u of users.users) {
    console.log(
      `  ${u.email}  confirmed=${Boolean(u.email_confirmed_at)}  banned=${
        (u as { banned_until?: string }).banned_until ?? "no"
      }`,
    );
  }

  console.log("\n=== profiles ===");
  const { data: profiles, error: pErr } = await admin.from("profiles").select("email, role, tenant_id");
  if (pErr) throw pErr;
  console.table(profiles);

  console.log("\n=== sign-in attempts ===");
  for (const acct of accounts) {
    const anon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email: acct.email,
      password: acct.password,
    });

    if (error || !data.session) {
      console.log(`\n  ${acct.label}  ${acct.email}`);
      console.log(`    SIGN-IN FAILED: ${error?.message} (code=${error?.code})`);
      continue;
    }

    const [, payload] = data.session.access_token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());

    console.log(`\n  ${acct.label}  ${acct.email}`);
    console.log(`    sign-in: OK`);
    console.log(`    app_metadata: ${JSON.stringify(claims.app_metadata)}`);

    const role = claims.app_metadata?.user_role;
    const tenantId = claims.app_metadata?.tenant_id;
    if (!role) {
      console.log(`    >>> HOOK NOT ACTIVE: no user_role claim. Login will be rejected by the app.`);
    } else {
      console.log(`    hook OK: user_role=${role} tenant_id=${tenantId ?? "null"}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
