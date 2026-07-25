/**
 * Links an existing auth user to a role (and tenant), or creates the user outright.
 *
 * Creating a user in the Supabase Auth dashboard only creates the auth.users row.
 * It cannot know which role or tenant that person belongs to, so there is
 * deliberately NO trigger auto-creating a profile -- a trigger would either have
 * to guess, or hand every new signup a default role. Provisioning is an explicit,
 * service_role operation. This script is that operation until the Phase 2 admin
 * UI replaces it.
 *
 * Without a profiles row the auth hook mints a token with no user_role, and the
 * app refuses the session (fail closed). So: every user needs this run once.
 *
 *   npx tsx --env-file=.env.local scripts/grant-role.ts <email> super_admin
 *   npx tsx --env-file=.env.local scripts/grant-role.ts <email> tenant_admin <tenant-slug>
 *
 *   # also creates the auth user if they don't exist yet:
 *   npx tsx --env-file=.env.local scripts/grant-role.ts <email> super_admin --password '<pw>'
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const pwIndex = args.indexOf("--password");
const password = pwIndex >= 0 ? args[pwIndex + 1] : undefined;
const positional = args.filter(
  (_, i) => pwIndex < 0 || (i !== pwIndex && i !== pwIndex + 1),
);

const [email, role, tenantSlug] = positional;

if (!email || !role) {
  console.error("usage: grant-role.ts <email> <super_admin|tenant_admin> [tenant-slug] [--password <pw>]");
  process.exit(1);
}
if (role !== "super_admin" && role !== "tenant_admin") {
  console.error(`Invalid role "${role}". Must be super_admin or tenant_admin.`);
  process.exit(1);
}
if (role === "tenant_admin" && !tenantSlug) {
  console.error("tenant_admin requires a tenant slug: grant-role.ts <email> tenant_admin <tenant-slug>");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Find the auth user (or create them).
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;

  let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    if (!password) {
      console.error(
        `No auth user for ${email}.\n` +
          `Either create them in Dashboard -> Authentication -> Users first, or pass --password '<pw>' to create them here.`,
      );
      process.exit(1);
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log(`  created auth user  ${email}`);
  } else {
    console.log(`  found auth user    ${email}  (${user.id})`);
    if (password) {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password });
      if (error) throw error;
      console.log(`  password updated`);
    }
  }

  // 2. Resolve the tenant. A super_admin is agency-global and MUST have a null
  //    tenant_id -- the profiles_role_tenant_coherent CHECK enforces it.
  let tenantId: string | null = null;
  if (role === "tenant_admin") {
    const { data: tenant, error } = await admin
      .from("tenants")
      .select("id, name")
      .eq("slug", tenantSlug)
      .maybeSingle();
    if (error) throw error;
    if (!tenant) {
      console.error(`No tenant with slug "${tenantSlug}".`);
      process.exit(1);
    }
    tenantId = tenant.id;
    console.log(`  tenant             ${tenant.name} (${tenantSlug})`);
  }

  // 3. The profile. This is the row that makes the auth hook emit a user_role.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: user.id, email, role, tenant_id: tenantId }, { onConflict: "id" });
  if (profileErr) throw profileErr;
  console.log(`  profile            role=${role} tenant_id=${tenantId ?? "null"}`);

  // 4. Prove it. The hook only runs at token issuance, so a stale session keeps
  //    its old (or missing) claims until it expires -- verify against a fresh token.
  if (password) {
    const anon = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      console.log(`\n  Could not verify (sign-in failed): ${error?.message}`);
    } else {
      const [, payload] = data.session.access_token.split(".");
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      const got = claims.app_metadata?.user_role;
      if (got === role) {
        console.log(`\n  verified           JWT now carries user_role=${got}`);
      } else {
        console.log(`\n  WARNING: JWT carries user_role=${got ?? "null"}. Is the auth hook enabled?`);
      }
    }
  }

  console.log(`\nDone. ${email} can now sign in as ${role}.`);
  if (!password) {
    console.log("(Existing sessions keep their old claims until the token expires. Sign out and back in.)");
  }
}

main().catch((e) => {
  console.error("\nFailed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
