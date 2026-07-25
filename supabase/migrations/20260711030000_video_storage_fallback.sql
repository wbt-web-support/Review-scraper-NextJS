-- =============================================================================
-- Supabase Storage fallback for review videos.
--
-- Bunny Stream remains the production path: it transcodes, serves HLS, generates
-- thumbnails, and its egress is cheap. This bucket exists so the product works
-- when Bunny is not configured (local dev, demos, a new install) instead of
-- disabling video reviews entirely.
--
-- Trade-offs, stated plainly, because they are real:
--   - No transcoding. The browser's raw WebM/MP4 is served back as-is. Safari
--     cannot play WebM, so a review recorded in Chrome may not play in Safari.
--   - No thumbnails.
--   - 50MB cap per file (below, roughly 2-3 minutes of phone video).
--   - Supabase egress is billed per GB and is far more expensive than a CDN.
--
-- The application prefers Bunny whenever BUNNY_* env vars are set. See
-- src/lib/video/provider.ts.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-videos',
  'review-videos',
  -- Public read. The alternative -- signed URLs -- expires, and these URLs are
  -- embedded in a widget on third-party sites and cached at a CDN, so an expiring
  -- URL would show up as randomly broken videos on a client's homepage.
  --
  -- What makes public acceptable: object paths are random UUIDs, and a video's URL
  -- is only ever published once the tenant APPROVES the review. An un-approved
  -- video is not enumerable and not linked anywhere.
  true,
  52428800, -- 50MB
  array['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read of the bucket's objects. Required for <video src> to work from a
-- client's website and from the subdomain page.
drop policy if exists "review_videos_public_read" on storage.objects;
create policy "review_videos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'review-videos');

-- No INSERT/UPDATE/DELETE policy for anon or authenticated, deliberately.
--
-- Reviewers upload via a SIGNED UPLOAD URL minted server-side by the collect route
-- (service_role), scoped to one specific object path we just generated. So a
-- reviewer can put bytes at exactly one path and nowhere else -- the same shape as
-- the Bunny TUS pre-signing. Without this, `anon` could write arbitrary objects
-- into the bucket, which is a free file host for the entire internet.
