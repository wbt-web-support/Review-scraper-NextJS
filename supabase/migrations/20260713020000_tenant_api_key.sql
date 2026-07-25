-- =============================================================================
-- tenants.api_key
--
-- Lets a client pull their own reviews into their own system: a CRM, a static
-- site build, a Zapier step, whatever they already run.
--
-- This is a SECRET, and that is the whole difference between it and embed_key.
-- embed_key sits in the HTML of a public website and grants only what the widget
-- already shows the world: approved reviews, PII stripped. api_key grants the
-- tenant's OWN view of their data -- pending and rejected reviews included, and
-- reviewer_email with them. It must therefore live server-side in the client's
-- system and never in a browser.
--
-- The vrm_ prefix is not decoration. It makes the key recognisable on sight in a
-- log, a pasted snippet, or a secret scanner, which is how a leaked key gets
-- noticed before it gets used.
-- =============================================================================

alter table public.tenants
  add column if not exists api_key text;

-- Backfill before NOT NULL, exactly as embed_key did.
update public.tenants
   set api_key = 'vrm_' || encode(gen_random_bytes(24), 'hex')
 where api_key is null;

alter table public.tenants
  alter column api_key set default 'vrm_' || encode(gen_random_bytes(24), 'hex');

alter table public.tenants
  alter column api_key set not null;

-- The API authenticates by looking the tenant up BY this key, so the index is
-- load-bearing, not just a uniqueness guard: without it every API call is a
-- sequential scan of the tenants table.
create unique index if not exists tenants_api_key_key on public.tenants (api_key);

-- Deliberately absent from the `authenticated` UPDATE column grants (see the init
-- migration). A tenant may READ their key -- tenants_select already scopes them to
-- their own row -- but rotating it is a privileged act that instantly breaks every
-- integration the client has built, so it goes through a super_admin route on
-- service_role. Postgres refuses the write even if the app forgets to check.
