/**
 * Seed: one demo tenant + a super admin and a tenant admin.
 *
 *   npm run seed
 *
 * Idempotent -- safe to re-run. Credentials come from .env.local, never from
 * source. Ends with a self-test that proves the custom access token hook is
 * actually enabled, which is the one setup step that otherwise fails silently.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { z } from 'zod/v4'

// Fail fast and loudly. A seed that half-runs against a misconfigured project is
// worse than one that refuses to start.
const Env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SEED_SUPER_ADMIN_EMAIL: z.email(),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(6),
  SEED_TENANT_ADMIN_EMAIL: z.email(),
  SEED_TENANT_ADMIN_PASSWORD: z.string().min(6),
  SEED_TENANT_NAME: z.string().min(1),
  SEED_TENANT_SLUG: z.string().regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, {
    error: 'SEED_TENANT_SLUG must be a DNS-safe label (lowercase, digits, hyphens).',
  }),
})

const parsed = Env.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment. Copy .env.example to .env.local and fill it in.\n')
  console.error(z.prettifyError(parsed.error))
  process.exit(1)
}
const env = parsed.data

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * createUser is not idempotent -- it 422s with `email_exists` on re-run. Recover
 * the existing id rather than failing the whole seed.
 */
async function ensureUser(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<User> {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip the verification email; usable immediately
  })

  if (!error && data.user) return data.user

  const alreadyExists =
    error?.code === 'email_exists' || /already been registered|already exists/i.test(error?.message ?? '')
  if (!alreadyExists) throw error

  // Filter server-side. Paginating every user breaks once the project has more
  // than a page of accounts.
  const { data: list, error: listErr } = await client.auth.admin.listUsers({ perPage: 200 })
  if (listErr) throw listErr

  const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!found) throw new Error(`${email} reports as existing but could not be found.`)

  // Keep the password in sync with .env.local on re-runs.
  const { data: updated, error: updErr } = await client.auth.admin.updateUserById(found.id, { password })
  if (updErr) throw updErr

  return updated.user
}

async function main() {
  console.log(`Seeding ${env.NEXT_PUBLIC_SUPABASE_URL}\n`)

  // 1. Tenant first. profiles.tenant_id has an FK to it, and the
  //    profiles_role_tenant_coherent CHECK forbids a tenant_admin with a null
  //    tenant_id -- so the reverse order is rejected by the database.
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .upsert(
      {
        name: env.SEED_TENANT_NAME,
        slug: env.SEED_TENANT_SLUG,
        subdomain: env.SEED_TENANT_SLUG,
        brand_color: '#8A9A5B',
        plan: 'agency',
      },
      { onConflict: 'slug' },
    )
    .select()
    .single()
  if (tenantErr) throw tenantErr
  console.log(`  tenant    ${tenant.name} (${tenant.slug}) -> ${tenant.id}`)

  // 2. Users. Track what we created so we can roll back on a later failure.
  const created: string[] = []
  try {
    const superAdmin = await ensureUser(admin, env.SEED_SUPER_ADMIN_EMAIL, env.SEED_SUPER_ADMIN_PASSWORD)
    created.push(superAdmin.id)
    const tenantAdmin = await ensureUser(admin, env.SEED_TENANT_ADMIN_EMAIL, env.SEED_TENANT_ADMIN_PASSWORD)
    created.push(tenantAdmin.id)

    // 3. Profiles, explicitly -- no trigger on auth.users. A trigger cannot know
    //    the tenant_id, and its failures surface as an opaque
    //    "Database error saving new user" at signup.
    //    super_admin.tenant_id MUST be null (CHECK constraint).
    const { error: profileErr } = await admin.from('profiles').upsert(
      [
        { id: superAdmin.id, tenant_id: null, role: 'super_admin', email: env.SEED_SUPER_ADMIN_EMAIL },
        { id: tenantAdmin.id, tenant_id: tenant.id, role: 'tenant_admin', email: env.SEED_TENANT_ADMIN_EMAIL },
      ],
      { onConflict: 'id' },
    )
    if (profileErr) throw profileErr
    console.log(`  profiles  super_admin=${env.SEED_SUPER_ADMIN_EMAIL} tenant_admin=${env.SEED_TENANT_ADMIN_EMAIL}`)

    // 4. 1:1 settings.
    const { error: csErr } = await admin.from('collection_settings').upsert(
      {
        tenant_id: tenant.id,
        prompt_questions: [
          'What problem were you trying to solve?',
          'What did we do for you?',
          'What was the result?',
        ],
        welcome_text: 'Tell us how we did.',
        thank_you_text: 'Thank you. Your review means a lot to us.',
      },
      { onConflict: 'tenant_id' },
    )
    if (csErr) throw csErr

    const { error: wsErr } = await admin
      .from('widget_settings')
      .upsert({ tenant_id: tenant.id, layout: 'grid', theme: 'light', autoplay: false }, { onConflict: 'tenant_id' })
    if (wsErr) throw wsErr
    console.log('  settings  collection + widget')

    // 5. Demo reviews: two approved so the widget renders on first run, one
    //    pending so the moderation queue isn't empty. Fixed ids => re-runnable.
    //    consent_given must be true; the CHECK constraint rejects false.
    const { error: reviewErr } = await admin.from('reviews').upsert(
      [
        {
          id: '11111111-1111-4111-8111-111111111111',
          tenant_id: tenant.id,
          reviewer_name: 'Sarah Whitfield',
          rating: 5,
          type: 'text',
          status: 'approved',
          consent_given: true,
          text_review:
            'They rewired the whole unit in two days with zero disruption to our trading. The quote was what we paid, to the penny.',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          tenant_id: tenant.id,
          reviewer_name: 'Marcus Boateng',
          rating: 5,
          type: 'text',
          status: 'approved',
          consent_given: true,
          text_review: 'Third job we have given them. They turn up when they say they will, which is rarer than it should be.',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          tenant_id: tenant.id,
          reviewer_name: 'Priya Raman',
          rating: 4,
          type: 'text',
          status: 'pending',
          consent_given: true,
          text_review: 'Good work on the solar install. Slight delay on the parts but they kept me in the loop.',
        },
      ],
      { onConflict: 'id' },
    )
    if (reviewErr) throw reviewErr
    console.log('  reviews   2 approved, 1 pending')
  } catch (err) {
    // Compensate, so a failed seed doesn't strand auth.users rows with no profile.
    for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {})
    throw err
  }

  await verifyAuthHook(tenant.id)
}

/**
 * The setup step that fails silently. If the hook isn't enabled in the dashboard,
 * everything above succeeds, login succeeds, and the app is simply empty forever
 * because no JWT carries a tenant_id. Sign in for real and look at the token.
 */
async function verifyAuthHook(expectedTenantId: string) {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await anon.auth.signInWithPassword({
    email: env.SEED_TENANT_ADMIN_EMAIL,
    password: env.SEED_TENANT_ADMIN_PASSWORD,
  })
  if (error || !data.session) throw new Error(`Self-test could not sign in: ${error?.message}`)

  const [, payload] = data.session.access_token.split('.')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    app_metadata?: { tenant_id?: string | null; user_role?: string | null }
  }
  const { tenant_id: tenantId, user_role: userRole } = claims.app_metadata ?? {}

  if (!tenantId || !userRole) {
    console.error('\n  FAILED: the JWT carries no tenant_id/user_role.')
    console.error('  The custom access token hook is not enabled.')
    console.error('  Dashboard -> Authentication -> Hooks -> Customize Access Token (JWT) Claims')
    console.error('    type: Postgres | schema: public | function: custom_access_token_hook\n')
    console.error(`  app_metadata was: ${JSON.stringify(claims.app_metadata ?? null)}\n`)
    process.exit(1)
  }

  if (tenantId !== expectedTenantId) {
    throw new Error(`JWT tenant_id ${tenantId} does not match the seeded tenant ${expectedTenantId}.`)
  }

  console.log(`\n  hook OK   JWT carries user_role=${userRole} tenant_id=${tenantId}`)
  console.log('\nSeed complete.')
}

main().catch((err) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
