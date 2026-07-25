-- =============================================================================
-- How long a review video may be, per tenant.
--
-- Default 180 seconds (3 minutes). A testimonial that runs long is a testimonial
-- nobody watches, and on Bunny every extra minute is billed twice: once to encode
-- it and again to serve it.
--
-- The recorder stops itself at this figure and refuses an over-length upload, but
-- neither of those is a security boundary -- the TUS signature is handed to the
-- browser, so a determined caller can push bytes straight at Bunny. The encode
-- webhook is the real gate: it reads the encoded length back from Bunny and
-- rejects anything over the limit.
--
-- Bounds are 15s..1800s. Below 15 seconds nobody can say anything useful; above
-- 30 minutes it isn't a testimonial.
--
-- AGENCY-ONLY. Deliberately absent from the `authenticated` column grants below,
-- so a tenant_admin cannot raise their own ceiling -- Postgres refuses the UPDATE.
-- Only a service_role write behind an assertRole('super_admin') check changes it.
-- =============================================================================

alter table public.tenants
  add column if not exists max_video_seconds int not null default 180;

do $$ begin
  alter table public.tenants
    add constraint tenants_max_video_seconds_check
      check (max_video_seconds between 15 and 1800);
exception when duplicate_object then null; end $$;

-- Restating the tenant-writable set. max_video_seconds is NOT in it, alongside
-- plan, slug, subdomain, embed_key, review_open_mode, and custom_domain_verified.
grant update (name, logo_url, brand_color, custom_domain, contact_email, contact_phone)
  on public.tenants to authenticated;
