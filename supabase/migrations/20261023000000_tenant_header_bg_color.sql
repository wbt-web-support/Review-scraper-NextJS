-- =============================================================================
-- Header background colour on tenants
--
-- The collection page shows the tenant's logo in a band across the top of the
-- card. That band was always white, so a client with a white (or very light) logo
-- got an invisible header. This lets each tenant pick the colour behind it.
--
-- White by default, so every existing tenant looks exactly as before.
-- =============================================================================

alter table public.tenants
  add column if not exists header_bg_color text not null default '#ffffff';

-- Same shape as the brand_color check.
do $$ begin
  alter table public.tenants
    add constraint tenants_header_bg_color_format check (
      header_bg_color ~* '^#[0-9a-f]{6}$'
    );
exception when duplicate_object then null; end $$;

-- Restating the tenant-writable set with header_bg_color added. It is branding,
-- so a tenant admin may change it alongside brand_color and logo_url.
grant update (name, logo_url, brand_color, header_bg_color, custom_domain, contact_email, contact_phone)
  on public.tenants to authenticated;
