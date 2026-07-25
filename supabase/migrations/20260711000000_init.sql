-- =============================================================================
-- Video Testimonial Platform — initial schema, auth hook, and RLS
--
-- Multi-tenancy is enforced by Row Level Security. tenant_id and user_role are
-- read from the signed JWT (populated by custom_access_token_hook below), never
-- by querying profiles from inside a policy -- that would recurse.
--
-- Idempotent: safe to re-run.
-- =============================================================================


-- =============================================================================
-- 1. ENUMS
--
-- Native enums (not TEXT + CHECK) for the fixed value sets, because
-- `supabase gen types` emits real TS string unions for them; a CHECK constraint
-- only emits `string`. `plan` and `theme` stay TEXT + CHECK because they churn
-- with pricing/design, and ALTER TYPE ... ADD VALUE cannot run in the same
-- transaction that uses it, which makes enum churn painful in migrations.
-- =============================================================================

do $$ begin
  create type public.user_role as enum ('super_admin', 'tenant_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_type as enum ('video', 'text');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.widget_layout as enum ('grid', 'carousel', 'single');
exception when duplicate_object then null; end $$;


-- =============================================================================
-- 2. updated_at TRIGGER FUNCTION
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =============================================================================
-- 3. TABLES
-- =============================================================================

-- ---------- tenants ----------
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 120),
  slug          text not null,
  logo_url      text,
  brand_color   text not null default '#8A9A5B'
                  check (brand_color ~* '^#[0-9a-f]{6}$'),
  custom_domain text,
  subdomain     text not null,
  plan          text not null default 'free'
                  check (plan in ('free', 'pro', 'agency')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- DNS-safe labels. These end up in URLs and (for subdomain) in DNS records,
  -- so constrain them at the DB rather than trusting every future caller.
  constraint tenants_slug_format      check (slug      ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  constraint tenants_subdomain_format check (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
);

create unique index if not exists tenants_slug_key      on public.tenants (slug);
create unique index if not exists tenants_subdomain_key on public.tenants (subdomain);

-- Partial: UNIQUE permits many NULLs, but being explicit documents the intent
-- that most tenants have no custom domain.
create unique index if not exists tenants_custom_domain_key on public.tenants (custom_domain)
  where custom_domain is not null;


-- ---------- profiles ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  tenant_id  uuid references public.tenants (id) on delete cascade,
  role       public.user_role not null,
  email      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A super_admin is agency-global (no tenant). A tenant_admin MUST be scoped.
  -- Without this, a tenant_admin with a NULL tenant_id is representable -- an
  -- account that could slip past a policy that forgets to null-check. Make the
  -- broken state impossible rather than remembering to handle it everywhere.
  constraint profiles_role_tenant_coherent check (
    (role = 'super_admin'  and tenant_id is null) or
    (role = 'tenant_admin' and tenant_id is not null)
  )
);

create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);


-- ---------- collection_settings (1:1 with tenant) ----------
create table if not exists public.collection_settings (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null unique references public.tenants (id) on delete cascade,
  prompt_questions jsonb not null default '[]'::jsonb
                     check (jsonb_typeof(prompt_questions) = 'array'),
  welcome_text     text not null default 'We would love to hear from you.',
  thank_you_text   text not null default 'Thank you for your review!',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);


-- ---------- reviews ----------
create table if not exists public.reviews (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  reviewer_name  text not null check (length(btrim(reviewer_name)) between 1 and 120),
  reviewer_email text check (reviewer_email is null or reviewer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  rating         int  not null check (rating between 1 and 5),
  video_guid     text,
  video_url      text,
  thumbnail_url  text,
  transcript     text,
  text_review    text,
  type           public.review_type   not null,
  status         public.review_status not null default 'pending',
  consent_given  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- GDPR. A testimonial without explicit consent must not be persistable at
  -- all, not merely hidden in the UI. If the submit route ever regresses, the
  -- database still refuses the row.
  constraint reviews_consent_required check (consent_given is true),

  -- A 'video' row is meaningless without the Bunny GUID. video_url/thumbnail_url
  -- stay nullable because they arrive later, via the encode webhook.
  -- A 'text' row is meaningless without body text.
  constraint reviews_payload_matches_type check (
    (type = 'video' and video_guid is not null) or
    (type = 'text'  and length(btrim(coalesce(text_review, ''))) > 0)
  )
);

-- The widget hot path: one tenant's approved reviews, newest first. Partial, so
-- it stays small (approved rows are a minority of a spam-prone table) and the
-- ORDER BY becomes a plain index scan.
create index if not exists reviews_tenant_approved_recent_idx
  on public.reviews (tenant_id, created_at desc)
  where status = 'approved';

-- The moderation queue: filter by tenant + any status.
create index if not exists reviews_tenant_status_created_idx
  on public.reviews (tenant_id, status, created_at desc);

-- The Bunny encode webhook arrives with only a GUID. Unique also makes that
-- handler idempotent -- a redelivered webhook can't create a duplicate row.
create unique index if not exists reviews_video_guid_key
  on public.reviews (video_guid)
  where video_guid is not null;


-- ---------- widget_settings (1:1 with tenant) ----------
create table if not exists public.widget_settings (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null unique references public.tenants (id) on delete cascade,
  layout     public.widget_layout not null default 'grid',
  theme      text not null default 'light' check (theme in ('light', 'dark', 'auto')),
  autoplay   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['tenants','profiles','collection_settings','reviews','widget_settings']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;


-- =============================================================================
-- 4. CUSTOM ACCESS TOKEN HOOK
--
-- Injects tenant_id + user_role into the JWT so RLS policies can read them from
-- auth.jwt() instead of querying profiles (which would recurse).
--
-- MUST be enabled by hand: Dashboard -> Authentication -> Hooks ->
-- "Customize Access Token (JWT) Claims" -> Postgres / public / custom_access_token_hook.
-- If you skip that step everything still appears to work: the migration
-- succeeds, login succeeds, and every user sees an empty app. scripts/seed.ts
-- ends with a self-test that catches exactly this.
--
-- Deliberately NOT `security definer` -- Supabase recommends against it here.
-- The function runs as supabase_auth_admin, which we grant exactly what it needs.
-- =============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_claims    jsonb;
  v_tenant_id uuid;
  v_role      text;
begin
  select p.tenant_id, p.role::text
    into v_tenant_id, v_role
    from public.profiles p
   where p.id = (event->>'user_id')::uuid;

  v_claims := event->'claims';

  -- Supabase already populates app_metadata with {provider, providers}.
  -- Merge into it; overwriting the whole object would clobber those.
  if jsonb_typeof(v_claims->'app_metadata') <> 'object' then
    v_claims := jsonb_set(v_claims, '{app_metadata}', '{}'::jsonb);
  end if;

  -- Write BOTH keys unconditionally, even as null. app_metadata is seeded from
  -- users.raw_app_meta_data, which a careless service_role script could poison.
  -- Always sourcing these two keys from `profiles` means a poisoned
  -- raw_app_meta_data can never survive into a minted JWT.
  v_claims := jsonb_set(v_claims, '{app_metadata,tenant_id}',
                coalesce(to_jsonb(v_tenant_id::text), 'null'::jsonb), true);
  v_claims := jsonb_set(v_claims, '{app_metadata,user_role}',
                coalesce(to_jsonb(v_role), 'null'::jsonb), true);

  -- No RAISE on a missing profile: throwing here surfaces as an opaque 500 at
  -- login. Fail closed instead -- null claims match no policy, so the user
  -- authenticates but sees nothing.
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;


-- ---------- hook grants (get these wrong and login breaks silently) ----------

-- The auth server's role must be able to enter the schema at all.
grant usage on schema public to supabase_auth_admin;

-- ...and execute the hook.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Without this revoke, any logged-in user -- or anyone holding the anon key,
-- i.e. the entire internet -- could call the hook over PostgREST RPC and probe
-- the profiles table with arbitrary user_ids.
revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

-- The hook reads profiles AS supabase_auth_admin. That role is not superuser and
-- does not have BYPASSRLS, so it needs a table grant AND an RLS policy (below).
-- SELECT is all the hook needs; the Supabase docs say `grant all`, which is more
-- than necessary.
grant select on table public.profiles to supabase_auth_admin;


-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

alter table public.tenants             enable row level security;
alter table public.profiles            enable row level security;
alter table public.collection_settings enable row level security;
alter table public.reviews             enable row level security;
alter table public.widget_settings     enable row level security;


-- ---------- baseline grants ----------

-- Defence in depth. Supabase's ALTER DEFAULT PRIVILEGES grants
-- SELECT/INSERT/UPDATE/DELETE on every new public table to anon + authenticated.
-- That makes RLS the ONLY thing standing between the anon key (which ships in
-- the browser bundle and is public by design) and the whole database. If anyone
-- ever disables RLS on a table for five minutes of debugging, that becomes a
-- full public dump. Revoking the grant makes RLS the second lock, not the only one.
--
-- anon gets nothing, anywhere. Public review submission and public widget reads
-- both go through server route handlers using service_role -- see
-- src/lib/supabase/admin.ts. RLS cannot prove a submitter actually visited the
-- collection page, cannot rate-limit, and cannot verify a Bunny video_guid is
-- real; and a trusted server hop already has to exist to talk to Bunny anyway.
revoke all on public.tenants, public.profiles, public.collection_settings,
              public.reviews, public.widget_settings
  from anon;

grant select, insert, update, delete
  on public.collection_settings, public.reviews, public.widget_settings
  to authenticated;

-- COLUMN-LEVEL grants. RLS cannot express "you may update this row but not that
-- column" -- WITH CHECK cannot reference the OLD row -- so column privileges are
-- the only correct tool for privilege-escalation defence.
--
-- The REVOKE is load-bearing and easy to miss. Supabase's default privileges
-- have ALREADY granted table-wide UPDATE on these tables to `authenticated`.
-- A column grant ADDS a privilege; it does not narrow an existing one. So
-- `grant update (email)` on top of an existing table-wide UPDATE leaves every
-- column writable and buys exactly nothing. Revoke to zero first, then re-grant
-- precisely. scripts/verify-rls.ts asserts this.
revoke all on public.tenants, public.profiles from authenticated;

grant select on public.tenants, public.profiles to authenticated;

-- Gated further by RLS to super_admin only (tenants_insert/delete_super_admin).
grant insert, delete on public.tenants to authenticated;

-- tenants: stops a tenant_admin self-upgrading `plan` free -> agency, or
-- rewriting slug/subdomain to hijack another tenant's public URL.
grant update (name, logo_url, brand_color, custom_domain) on public.tenants to authenticated;

-- profiles: stops a tenant_admin PATCHing their own row to role='super_admin'
-- (which the hook would then faithfully mint into their next JWT, granting full
-- cross-tenant read of every client's customers), or moving their tenant_id.
-- No INSERT/DELETE grant at all: provisioning is a service_role operation.
grant update (email) on public.profiles to authenticated;

-- Consequence, by design: creating tenants and changing plans/roles must go
-- through server routes using service_role with an explicit is_super_admin()
-- check. Column grants bind the `authenticated` role as a whole, super_admins
-- included.


-- ---------- supabase_auth_admin policy on profiles ----------
--
-- MANDATORY. RLS is enabled on profiles and supabase_auth_admin is not exempt.
-- Without this the hook's SELECT returns zero rows, tenant_id comes back NULL,
-- and every user logs in successfully but sees an empty app -- with no error
-- logged anywhere. This is the single most common failure of this design.
drop policy if exists "auth_admin_can_read_profiles" on public.profiles;
create policy "auth_admin_can_read_profiles"
  on public.profiles
  as permissive for select
  to supabase_auth_admin
  using (true);


-- =============================================================================
-- 6. CLAIM HELPERS (the anti-recursion layer)
--
-- These read ONLY the signed JWT. They touch no tables. That is the entire point:
-- the naive policy
--     using (tenant_id = (select tenant_id from public.profiles where id = auth.uid()))
-- re-enters profiles' own SELECT policy and errors with
--     42P17: infinite recursion detected in policy for relation "profiles"
-- Sourcing tenant_id from the token makes every policy a pure function of the JWT.
--
-- No `set search_path` clause: a SET clause makes a function non-inlinable, and
-- these run inside RLS predicates where inlining matters. They are not SECURITY
-- DEFINER, so they execute with the caller's own rights -- search_path hijacking
-- is not an escalation vector here. Names are fully qualified regardless.
-- =============================================================================

create or replace function public.jwt_tenant_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

create or replace function public.jwt_user_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '');
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable as $$
  select public.jwt_user_role() = 'super_admin';
$$;

-- Central tenant gate. `target is not null` is load-bearing: it stops a
-- null-tenant JWT from matching a null tenant_id row.
create or replace function public.has_tenant_access(target uuid)
returns boolean language sql stable as $$
  select public.is_super_admin()
      or (target is not null and target = public.jwt_tenant_id());
$$;

grant execute on function public.jwt_tenant_id(), public.jwt_user_role(),
                          public.is_super_admin(), public.has_tenant_access(uuid)
  to authenticated;
revoke execute on function public.jwt_tenant_id(), public.jwt_user_role(),
                           public.is_super_admin(), public.has_tenant_access(uuid)
  from anon, public;


-- =============================================================================
-- 7. POLICIES
--
-- Every helper call is wrapped in (select ...). That is not cosmetic: it
-- promotes the call to an InitPlan evaluated ONCE PER QUERY rather than once per
-- row. On a 50k-row reviews table the unwrapped form is measurably slower.
--
-- USING gates the OLD row; WITH CHECK gates the NEW row. Both are needed on
-- UPDATE: USING alone inspects only the pre-image, so it would happily permit
-- `UPDATE ... SET tenant_id = <victim>` -- re-parenting a row into another tenant.
-- =============================================================================

-- ---------- tenants ----------

-- Blocks: Tenant A enumerating Tenant B's name/plan/custom_domain -- effectively
-- a competitor list of the agency's entire client book.
drop policy if exists "tenants_select" on public.tenants;
create policy "tenants_select" on public.tenants
  for select to authenticated
  using ( (select public.is_super_admin()) or id = (select public.jwt_tenant_id()) );

drop policy if exists "tenants_insert_super_admin" on public.tenants;
create policy "tenants_insert_super_admin" on public.tenants
  for insert to authenticated
  with check ( (select public.is_super_admin()) );

drop policy if exists "tenants_update" on public.tenants;
create policy "tenants_update" on public.tenants
  for update to authenticated
  using      ( (select public.is_super_admin()) or id = (select public.jwt_tenant_id()) )
  with check ( (select public.is_super_admin()) or id = (select public.jwt_tenant_id()) );

drop policy if exists "tenants_delete_super_admin" on public.tenants;
create policy "tenants_delete_super_admin" on public.tenants
  for delete to authenticated
  using ( (select public.is_super_admin()) );


-- ---------- profiles ----------

-- Self, same-tenant teammates, or the agency. Reads only the JWT -> no recursion.
-- Blocks: cross-tenant user enumeration (harvesting client staff emails).
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
        id = (select auth.uid())
     or (select public.is_super_admin())
     or (tenant_id is not null and tenant_id = (select public.jwt_tenant_id()))
  );

-- Row-level gate only. The privilege-escalation gate is the column grant above
-- (only `email` is updatable), NOT this policy.
drop policy if exists "profiles_update_self_or_super_admin" on public.profiles;
create policy "profiles_update_self_or_super_admin" on public.profiles
  for update to authenticated
  using      ( id = (select auth.uid()) or (select public.is_super_admin()) )
  with check ( id = (select auth.uid()) or (select public.is_super_admin()) );

-- No INSERT/DELETE policy for `authenticated`: user provisioning and removal are
-- service_role operations (they must create the auth.users row in the same flow
-- anyway). No policy = deny.


-- ---------- collection_settings ----------
drop policy if exists "collection_settings_rw" on public.collection_settings;
create policy "collection_settings_rw" on public.collection_settings
  for all to authenticated
  using      ( (select public.has_tenant_access(tenant_id)) )
  with check ( (select public.has_tenant_access(tenant_id)) );


-- ---------- widget_settings ----------
drop policy if exists "widget_settings_rw" on public.widget_settings;
create policy "widget_settings_rw" on public.widget_settings
  for all to authenticated
  using      ( (select public.has_tenant_access(tenant_id)) )
  with check ( (select public.has_tenant_access(tenant_id)) );


-- ---------- reviews ----------

-- Blocks: reading another tenant's testimonials, including the reviewer_email
-- PII of their customers.
drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews
  for select to authenticated
  using ( (select public.has_tenant_access(tenant_id)) );

-- Approve / reject. WITH CHECK stops re-parenting a review into another tenant,
-- e.g. injecting a defamatory testimonial onto a competitor's widget.
drop policy if exists "reviews_update" on public.reviews;
create policy "reviews_update" on public.reviews
  for update to authenticated
  using      ( (select public.has_tenant_access(tenant_id)) )
  with check ( (select public.has_tenant_access(tenant_id)) );

drop policy if exists "reviews_delete" on public.reviews;
create policy "reviews_delete" on public.reviews
  for delete to authenticated
  using ( (select public.has_tenant_access(tenant_id)) );

-- Dashboard "add a testimonial manually", e.g. transcribing a Google review.
drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert" on public.reviews
  for insert to authenticated
  with check ( (select public.has_tenant_access(tenant_id)) );


-- #############################################################################
-- DELIBERATELY ABSENT: every `anon` policy.
--
-- anon has no grant and no policy on any table. Public review submission and
-- public widget reads are both server-side. See the note at the revoke in
-- section 5 for why.
-- #############################################################################
