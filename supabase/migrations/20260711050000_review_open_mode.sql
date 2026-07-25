-- =============================================================================
-- How the widget's "Leave a review" button behaves.
--
--   'dialog' (default) -- opens the collection page in a modal, on the client's own
--                         website. The visitor never leaves the page, which is where
--                         conversion is won.
--   'page'             -- opens the collection page full-page, in a new tab.
--
-- In 'page' mode the link points at the tenant's VERIFIED CUSTOM DOMAIN when they
-- have one (review.theirdomain.com/c/<slug>), so the visitor stays on a domain they
-- recognise. Without one it falls back to this app's own host -- which works, but
-- sends the visitor to a domain they've never seen mid-journey, so the admin UI
-- nudges toward setting a custom domain.
--
-- AGENCY-ONLY. Deliberately absent from the `authenticated` column grants below, so
-- a tenant_admin cannot set it at all -- Postgres refuses the UPDATE. Only a
-- service_role write behind an assertRole('super_admin') check can change it.
-- =============================================================================

alter table public.tenants
  add column if not exists review_open_mode text not null default 'dialog';

do $$ begin
  alter table public.tenants
    add constraint tenants_review_open_mode_check
      check (review_open_mode in ('dialog', 'page'));
exception when duplicate_object then null; end $$;

-- Restating the tenant-writable set. review_open_mode is NOT in it, alongside
-- plan, slug, subdomain, embed_key, and custom_domain_verified.
grant update (name, logo_url, brand_color, custom_domain, contact_email, contact_phone)
  on public.tenants to authenticated;
