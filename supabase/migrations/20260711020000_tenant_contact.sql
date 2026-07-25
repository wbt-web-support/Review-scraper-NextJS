-- =============================================================================
-- Phase 2b: business contact details on tenants
--
-- The business email doubles as the tenant admin's login, so provisioning is a
-- single step: create the tenant and its login together, rather than creating the
-- tenant and then remembering to invite someone.
-- =============================================================================

alter table public.tenants
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

-- Same shape as the reviewer_email check. Nullable, but if present it must look
-- like an address.
do $$ begin
  alter table public.tenants
    add constraint tenants_contact_email_format check (
      contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    );
exception when duplicate_object then null; end $$;

-- A tenant admin may edit their own contact details. Note this REPLACES the
-- earlier column grant rather than adding to it -- `grant update (a, b)` does not
-- accumulate with a previous `grant update (c)`, it is a separate grant per
-- column, so listing all of them here is the safe way to express the full set.
--
-- Still deliberately absent: plan, slug, subdomain, embed_key. Those remain
-- service_role-only, which is what stops a tenant admin self-upgrading their plan
-- or hijacking another tenant's public URL.
grant update (name, logo_url, brand_color, custom_domain, contact_email, contact_phone)
  on public.tenants to authenticated;
