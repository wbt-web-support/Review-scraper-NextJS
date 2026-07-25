# Supabase setup

Do these in order. **Several of these steps fail silently if skipped** — the app
still builds, login still succeeds, and users just see an empty screen.

## 1. Create the project

Create a hosted project at [supabase.com](https://supabase.com). Save the DB password.

## 2. Run the migration

Paste `migrations/20260711000000_init.sql` into the SQL Editor and run it. It is
idempotent, so re-running is safe.

## 3. ★ Enable the auth hook ★

**Authentication → Hooks → Customize Access Token (JWT) Claims**
→ type `Postgres`, schema `public`, function `custom_access_token_hook` → **Enable**.

This is the step everyone forgets. Without it, no JWT carries a `tenant_id`, so
every RLS policy matches zero rows: the migration succeeded, login succeeds, and
every user sees an empty app with no error logged anywhere. `npm run seed` ends
with a self-test that catches exactly this.

## 4. Disable public sign-ups

**Authentication → Sign In / Providers → "Allow new users to sign up" → OFF.**

Provisioning is agency-only: super admins create tenants, tenant admins are
invited. Left on, anyone can self-register.

## 5. Copy the keys

**Project Settings → API** → into `.env.local` (see `.env.example`).
`SUPABASE_SERVICE_ROLE_KEY` must **never** get a `NEXT_PUBLIC_` prefix.

## 6. Seed

```bash
npm run seed
```

## 7. Recommended: asymmetric JWT signing keys

**Authentication → JWT Keys** → migrate to ECC/RSA. With the legacy shared-secret
HS256 setup, `getClaims()` must make a network round-trip to verify on *every*
DAL call. With asymmetric keys it verifies locally against the JWKS.

---

## Verify RLS actually holds

Do this before trusting the schema. In the SQL Editor, impersonate a tenant admin
and try to escape their tenant:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<b-admin-uuid>","role":"authenticated",
  "app_metadata":{"tenant_id":"<TENANT_B_UUID>","user_role":"tenant_admin"}}';

select count(*) from public.reviews;              -- only Tenant B's rows
update public.tenants  set plan = 'agency';       -- permission denied for column plan
update public.profiles set role = 'super_admin';  -- permission denied for column role

reset role;
```

## Later: adopting the Supabase CLI

This machine has no Docker, so the local stack isn't currently usable. When you
adopt it (`supabase init` && `supabase link`), the dashboard hook toggle has no
local equivalent — add this to the generated `config.toml`:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

## Operational note: claims are baked in at issuance

Demoting a user or moving them between tenants leaves their **old JWT valid until
it expires** (default 1h). Revocation is not instant. Call
`supabase.auth.refreshSession()` immediately after any role/tenant mutation, and
consider shortening JWT expiry if that window is unacceptable.
