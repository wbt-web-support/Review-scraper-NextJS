-- =============================================================================
-- Custom domains.
--
-- A tenant who owns njdesignpark.com wants their reviews to live at
-- review.njdesignpark.com -- on THEIR domain, not a subdomain of ours. The
-- "review." label is fixed by us; the tenant supplies the root domain and points
-- DNS at us with a CNAME.
--
-- custom_domain therefore stores the FULL hostname ("review.njdesignpark.com"),
-- not the root. An exact host match is all the proxy has to do -- no prefix
-- parsing on the hot path of every request.
-- =============================================================================

alter table public.tenants
  add column if not exists custom_domain_verified boolean not null default false;

-- A DNS hostname. Prevents a tenant claiming, say, "localhost" or a host with a
-- path/port smuggled into it.
do $$ begin
  alter table public.tenants
    add constraint tenants_custom_domain_format check (
      custom_domain is null or
      custom_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'
    );
exception when duplicate_object then null; end $$;

-- The tenant may CLAIM a domain (custom_domain is in the column grant below), but
-- must never be able to mark it VERIFIED -- verification is a DNS check we perform
-- server-side with service_role. Without that split, a tenant could simply set the
-- flag and have us serve their content on a domain they do not control.
--
-- Restating the full set: a `grant update (col)` is per-column, so every allowed
-- column must be listed. custom_domain_verified, plan, slug, subdomain, and
-- embed_key are all deliberately absent.
grant update (name, logo_url, brand_color, custom_domain, contact_email, contact_phone)
  on public.tenants to authenticated;
