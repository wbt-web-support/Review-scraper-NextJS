-- A short description/subtitle shown under the welcome title on the collection page.
-- Nullable-by-default via an empty-string default, so existing tenants are unaffected.
alter table public.collection_settings
  add column if not exists description text not null default '';

-- The tenant's own dashboard edits collection_settings under RLS + column grants
-- (server writes use service_role and bypass these, but keep the grant consistent).
grant update (description) on public.collection_settings to authenticated;
