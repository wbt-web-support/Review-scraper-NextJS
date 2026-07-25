/**
 * Proves the multi-tenancy guarantee actually holds. Run after any change to the
 * schema or policies -- RLS failures are silent by nature, so they need an
 * explicit test.
 *
 *   DATABASE_URL=postgresql://... npx tsx scripts/verify-rls.ts
 *
 * Creates a second, throwaway tenant, then impersonates its admin (by setting
 * request.jwt.claims, exactly as PostgREST does) and tries to escape into the
 * seeded tenant. Every escape attempt must fail.
 */
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail: string) {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}\n        ${detail}`)
  }
}

/** Runs `sql` as tenant B's admin and expects it to be blocked. */
async function expectBlocked(name: string, jwt: string, sql: string) {
  await client.query('begin')
  try {
    await client.query(`set local role authenticated`)
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwt])
    const res = await client.query(sql)
    // An UPDATE blocked by RLS isn't an error -- it just affects zero rows.
    if (typeof res.rowCount === 'number' && res.rowCount === 0 && /^\s*update/i.test(sql)) {
      check(name, true, '')
    } else {
      check(name, false, `expected a block, but the statement succeeded (rowCount=${res.rowCount})`)
    }
  } catch (err) {
    // A column-grant denial raises. That is the expected outcome.
    check(name, true, '')
    void err
  } finally {
    await client.query('rollback')
  }
}

async function main() {
  await client.connect()
  console.log('Verifying RLS against', DATABASE_URL!.replace(/:[^:@]+@/, ':****@'), '\n')

  // --- Structural checks ----------------------------------------------------
  console.log('Structure')

  const { rows: rls } = await client.query(`
    select relname, relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r'`)
  const noRls = rls.filter((r) => !r.relrowsecurity).map((r) => r.relname)
  check('RLS enabled on every public table', noRls.length === 0, `missing on: ${noRls.join(', ')}`)

  const { rows: anonGrants } = await client.query(`
    select table_name, privilege_type from information_schema.role_table_grants
    where grantee='anon' and table_schema='public'`)
  check(
    'anon has zero table privileges',
    anonGrants.length === 0,
    `anon can: ${anonGrants.map((g) => `${g.privilege_type} ${g.table_name}`).join(', ')}`,
  )

  const { rows: hookExec } = await client.query(`
    select has_function_privilege('supabase_auth_admin', p.oid, 'execute') as admin_ok,
           has_function_privilege('anon', p.oid, 'execute') as anon_ok
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='custom_access_token_hook'`)
  check('auth hook exists and supabase_auth_admin can execute it', hookExec[0]?.admin_ok === true, 'hook missing or not granted')
  check('anon CANNOT execute the auth hook', hookExec[0]?.anon_ok === false, 'anon can call the hook over RPC')

  const { rows: profSel } = await client.query(
    `select has_table_privilege('supabase_auth_admin','public.profiles','select') as ok`,
  )
  check('supabase_auth_admin can SELECT profiles (else login silently yields null claims)', profSel[0]?.ok === true, '')

  const { rows: cols } = await client.query(`
    select table_name, column_name from information_schema.column_privileges
    where grantee='authenticated' and table_schema='public' and privilege_type='UPDATE'
      and table_name in ('tenants','profiles')`)
  const updatable = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`))
  check('authenticated CANNOT update profiles.role', !updatable.has('profiles.role'), 'privilege escalation is possible')
  check('authenticated CANNOT update profiles.tenant_id', !updatable.has('profiles.tenant_id'), 'tenant hopping is possible')
  check('authenticated CANNOT update tenants.plan', !updatable.has('tenants.plan'), 'self-upgrade is possible')
  check('authenticated CANNOT update tenants.slug', !updatable.has('tenants.slug'), 'URL hijack is possible')

  // --- Cross-tenant isolation ----------------------------------------------
  console.log('\nCross-tenant isolation')

  const { rows: tenants } = await client.query(`select id, slug from public.tenants order by created_at limit 1`)
  if (tenants.length === 0) {
    console.log('  SKIP  no tenants -- run `npm run seed` first')
    await client.end()
    process.exit(failed > 0 ? 1 : 0)
  }
  const tenantA = tenants[0]

  // A throwaway tenant B, whose admin will try to reach into tenant A.
  await client.query(`
    insert into public.tenants (name, slug, subdomain)
    values ('RLS Probe', 'rls-probe', 'rls-probe')
    on conflict (slug) do update set name = excluded.name`)
  const { rows: bRows } = await client.query(`select id from public.tenants where slug='rls-probe'`)
  const tenantB = bRows[0]

  const jwtB = JSON.stringify({
    sub: '00000000-0000-4000-8000-0000000000b0',
    role: 'authenticated',
    app_metadata: { tenant_id: tenantB.id, user_role: 'tenant_admin' },
  })

  // A review in tenant A that tenant B must not see.
  await client.query(
    `insert into public.reviews (id, tenant_id, reviewer_name, rating, type, status, consent_given, text_review)
     values ('44444444-4444-4444-8444-444444444444', $1, 'Isolation Probe', 5, 'text', 'approved', true, 'secret')
     on conflict (id) do nothing`,
    [tenantA.id],
  )

  // Read isolation.
  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtB])
  const { rows: visible } = await client.query(`select tenant_id from public.reviews`)
  await client.query('rollback')
  const leaked = visible.filter((r) => r.tenant_id !== tenantB.id)
  check(
    "tenant B cannot READ tenant A's reviews",
    leaked.length === 0,
    `${leaked.length} row(s) from another tenant were visible`,
  )

  await client.query('begin')
  await client.query(`set local role authenticated`)
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [jwtB])
  const { rows: visibleTenants } = await client.query(`select id from public.tenants`)
  await client.query('rollback')
  check(
    "tenant B cannot ENUMERATE other tenants",
    visibleTenants.every((t) => t.id === tenantB.id),
    `saw ${visibleTenants.length} tenants`,
  )

  // Write isolation.
  await expectBlocked(
    "tenant B cannot APPROVE tenant A's review",
    jwtB,
    `update public.reviews set status='rejected' where tenant_id <> '${tenantB.id}'`,
  )
  await expectBlocked(
    'tenant B cannot RE-PARENT its review into tenant A',
    jwtB,
    `update public.reviews set tenant_id='${tenantA.id}' where tenant_id='${tenantB.id}'`,
  )
  await expectBlocked(
    'tenant B cannot INSERT a review into tenant A',
    jwtB,
    `insert into public.reviews (tenant_id, reviewer_name, rating, type, consent_given, text_review)
     values ('${tenantA.id}', 'Injected', 1, 'text', true, 'defamatory')`,
  )
  await expectBlocked(
    'tenant B cannot ESCALATE itself to super_admin',
    jwtB,
    `update public.profiles set role='super_admin'`,
  )
  await expectBlocked('tenant B cannot UPGRADE its own plan', jwtB, `update public.tenants set plan='agency'`)

  // Cleanup.
  await client.query(`delete from public.reviews where id='44444444-4444-4444-8444-444444444444'`)
  await client.query(`delete from public.tenants where slug='rls-probe'`)

  console.log(`\n${passed} passed, ${failed} failed`)
  await client.end()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('\nverify-rls failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
