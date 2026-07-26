import "@vrm/lib/server-guard";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@vrm/lib/supabase/admin";
import { slugify, isValidSlug, RESERVED_SLUGS } from "./slug";
import { titleCaseName } from "./display-name";
import { normalizeRootDomain, reviewHostFor } from "@vrm/lib/domains/domain";
import type { Tenant, CreateTenantInput } from "./queries";

/**
 * Tenant provisioning, with NO authorization of its own.
 *
 * This exists because two different products in this app now provision tenants,
 * and they authorize in completely different ways:
 *
 *   - the video app's /video/admin dialog: a Supabase session, assertRole('super_admin')
 *   - the review scraper's Create Widget modal: a NextAuth session, no Supabase user
 *     at all
 *
 * Rather than fork a hundred lines of provisioning logic (which would drift, and the
 * copy nobody looks at would be the one that gets it wrong), the shared body lives
 * here and the CALLER is responsible for having authorized the request.
 *
 * Every caller must authorize before calling. There is no check in this file.
 *
 * The `db` parameter is how both authorization models survive intact. The video app
 * passes its RLS-scoped client, so the tenants_insert_super_admin policy is still the
 * thing that permits the INSERT -- exactly as before. The scraper passes the admin
 * client, because a NextAuth user has no Supabase JWT for a policy to evaluate, and
 * its own session check is the authorization instead.
 *
 * `admin` is used regardless for the parts RLS cannot do: auth.admin.*, the profiles
 * insert (no INSERT policy exists for `authenticated`), and the rollback.
 */
export async function provisionTenant(
  input: CreateTenantInput,
  db: SupabaseClient,
): Promise<{ ok: true; tenant: Tenant } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const base = slugify(input.name);
  if (!base) {
    return { ok: false, error: "That name has no letters or numbers to build a URL from." };
  }

  const slug = await findFreeSlug(base);
  if (!isValidSlug(slug)) {
    return { ok: false, error: `Could not build a valid URL from "${input.name}".` };
  }

  // Check the login email is free BEFORE creating the tenant, so the common
  // mistake (re-using an email) doesn't leave a tenant behind to clean up.
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (existing.users.some((u) => u.email?.toLowerCase() === input.contactEmail.toLowerCase())) {
    return { ok: false, error: "That email already has an account." };
  }

  // Their own domain, if they gave one. Stored UNVERIFIED -- claiming a hostname
  // at onboarding is not proof of owning it, and /d/[host] serves nothing until a
  // DNS lookup says otherwise. Recording it now just means the DNS instructions are
  // waiting on their tenant page from day one, instead of you chasing them later.
  let customDomain: string | null = null;
  if (input.rootDomain?.trim()) {
    const root = normalizeRootDomain(input.rootDomain);
    if (!root) {
      return {
        ok: false,
        error: "That doesn't look like a domain. Try something like njdesignpark.com",
      };
    }
    customDomain = reviewHostFor(root);
  }

  const { data: tenant, error } = await db
    .from("tenants")
    .insert({
      name: input.name.trim(),
      slug,
      subdomain: slug,
      contact_email: input.contactEmail.trim(),
      contact_phone: input.contactPhone?.trim() || null,
      custom_domain: customDomain,
      brand_color: input.brandColor,
      logo_url: input.logoUrl?.trim() || null,
      plan: input.plan ?? "free",
      // embed_key comes from the column default (16 random bytes).
      // custom_domain_verified stays false: it is not in the tenant column grants
      // and only a DNS check can flip it.
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation. Either the slug was taken between findFreeSlug and
    // here (the unique index is the real guard, not findFreeSlug), or the domain is
    // already claimed by another tenant.
    if (error.code === "23505") {
      return {
        ok: false,
        error: error.message.includes("custom_domain")
          ? "That domain is already connected to another business."
          : "That URL was just taken. Try again.",
      };
    }
    return { ok: false, error: error.message };
  }

  const rollback = async () => {
    // collection_settings / widget_settings / profiles all cascade on tenant delete.
    await admin.from("tenants").delete().eq("id", tenant.id);
  };

  try {
    // Defaults, so the collection page and widget work the moment the tenant exists.
    const { error: csErr } = await db.from("collection_settings").insert({
      tenant_id: tenant.id,
      // Starting copy on the client's behalf -- the first thing their customer reads.
      // These are DEFAULTS only; every client can rewrite them in their settings.
      prompt_questions: [
        "What problem were you trying to solve?",
        "Why did you choose us?",
        "How was your experience with our team?",
        "What was the outcome?",
        "Would you recommend us?",
      ],
      welcome_text: `Tell us about your experience with ${titleCaseName(tenant.name)}`,
      description: "30-60 seconds is perfect.",
      thank_you_text: "Thank you. Your review means a lot to us.",
    });
    if (csErr) throw new Error(csErr.message);

    const { error: wsErr } = await db
      .from("widget_settings")
      .insert({ tenant_id: tenant.id, layout: "grid", theme: "light", autoplay: false });
    if (wsErr) throw new Error(wsErr.message);

    const result = await provisionTenantAdmin(
      tenant.id,
      input.contactEmail,
      input.adminPassword,
    );
    if (!result.ok) throw new Error(result.error);
  } catch (err) {
    await rollback();
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not finish creating the tenant.",
    };
  }

  return { ok: true, tenant: tenant as Tenant };
}

/**
 * Creates a tenant_admin login. No authorization of its own -- see provisionTenant.
 *
 * service_role is required twice over: auth.admin.createUser is a privileged API,
 * and profiles has no INSERT policy for `authenticated` at all (provisioning is
 * deliberately not something a logged-in user can do).
 */
export async function provisionTenantAdmin(
  tenantId: string,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    if (error?.code === "email_exists") {
      return { ok: false, error: "That email already has an account." };
    }
    return { ok: false, error: error?.message ?? "Could not create the user." };
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .insert({ id: data.user.id, email, role: "tenant_admin", tenant_id: tenantId });

  if (profileErr) {
    // Compensate: never strand an auth user with no profile. They would be able
    // to authenticate but would get a token with no role, and see nothing.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    return { ok: false, error: profileErr.message };
  }

  return { ok: true };
}

/**
 * A slug nobody else holds.
 *
 * Uses the admin client because it must see EVERY tenant to know what is taken --
 * an RLS-scoped read would happily hand back a slug that already exists but is
 * invisible to the caller.
 */
async function findFreeSlug(desired: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("slug, subdomain")
    .or(`slug.like.${desired}%,subdomain.like.${desired}%`);
  if (error) throw error;

  const taken = new Set<string>();
  for (const row of data ?? []) {
    taken.add(row.slug);
    taken.add(row.subdomain);
  }

  if (!taken.has(desired) && !RESERVED_SLUGS.has(desired)) return desired;

  for (let n = 2; n < 1000; n++) {
    const candidate = `${desired}-${n}`.slice(0, 63).replace(/-+$/g, "");
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Could not find a free slug for "${desired}".`);
}
