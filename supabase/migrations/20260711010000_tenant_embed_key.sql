-- =============================================================================
-- Phase 2: tenants.embed_key
--
-- The widget is embedded as <script src=".../w.js" data-tenant="KEY">. That KEY
-- is public by definition -- it sits in the HTML of the client's website.
--
-- So it is an IDENTIFIER, not a secret: it must not be guessable (or anyone could
-- enumerate tenants and scrape their testimonials), but possessing it grants only
-- what the widget endpoint already exposes publicly -- approved reviews, minus PII.
-- It is deliberately NOT the tenant slug: the slug is human-readable and appears
-- in collection URLs, so reusing it would let anyone who saw a collection link
-- guess the embed key.
-- =============================================================================

alter table public.tenants
  add column if not exists embed_key text;

-- Backfill any existing rows before the NOT NULL.
update public.tenants
   set embed_key = encode(gen_random_bytes(16), 'hex')
 where embed_key is null;

alter table public.tenants
  alter column embed_key set default encode(gen_random_bytes(16), 'hex');

alter table public.tenants
  alter column embed_key set not null;

create unique index if not exists tenants_embed_key_key on public.tenants (embed_key);

-- Rotating a compromised/leaked key is a privileged operation: it instantly
-- breaks every existing embed on the client's site. Keep it out of the
-- `authenticated` column grants (see the tenants UPDATE grant in the init
-- migration -- embed_key is deliberately absent from it), so it can only be
-- changed via a service_role route with a super_admin check.
