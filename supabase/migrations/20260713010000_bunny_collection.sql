-- =============================================================================
-- Each tenant's videos get their own folder in Bunny.
--
-- Bunny Stream has one library per project, and by default every video lands in
-- the root of it. So a library holds every client's testimonials in a single
-- undifferentiated pile: you cannot tell whose is whose, cannot hand a client
-- their own footage, and cannot clean up after one client without picking their
-- videos out by hand.
--
-- Bunny's answer is a COLLECTION -- a folder inside the library. This column holds
-- the GUID of the one collection that belongs to this tenant. It is created lazily,
-- on the tenant's first video, and every video after that is created straight into
-- it (Create Video takes a collectionId).
--
-- Nullable on purpose, and it means three different things, all of them fine:
--   - Bunny is not configured (the Supabase Storage fallback is in use, which has
--     always namespaced by tenant: <tenant_id>/<uuid>.webm)
--   - the tenant has not had a video yet
--   - creating the collection failed, and we let the upload through anyway rather
--     than lose a customer's testimonial. scripts/backfill-bunny-collections.ts
--     sweeps those back into place.
--
-- AGENCY-ONLY, and really infrastructure rather than a setting: it is absent from
-- the `authenticated` column grants, so no tenant can point their collection at
-- another tenant's folder. Only service_role writes it.
-- =============================================================================

alter table public.tenants
  add column if not exists bunny_collection_id text;

-- Restating the tenant-writable set. bunny_collection_id is NOT in it, alongside
-- plan, slug, subdomain, embed_key, review_open_mode, max_video_seconds, and
-- custom_domain_verified.
grant update (name, logo_url, brand_color, custom_domain, contact_email, contact_phone)
  on public.tenants to authenticated;
