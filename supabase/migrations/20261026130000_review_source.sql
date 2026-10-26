-- =============================================================================
-- Where a review came from
--
-- Until now every review arrived the same way: a customer recorded or uploaded
-- it on the collection page. Businesses can now add testimonial videos they
-- already had (POST /api/v1/uploads), and those need telling apart from the ones
-- their customers sent in: a business's own upload carries no proof the reviewer
-- used our page, so it should never pass for one.
--
--   collected  a customer sent it through /c/<slug>   (every existing row)
--   uploaded   the business added it themselves
--
-- 'collected' by default, so every existing review and every insert that does
-- not name a source (the collect form) is exactly what it was before.
--
-- Table-level grants on reviews already cover a new column; nothing to restate.
-- =============================================================================

alter table public.reviews
  add column if not exists source text not null default 'collected';

do $$ begin
  alter table public.reviews
    add constraint reviews_source_check check (source in ('collected', 'uploaded'));
exception when duplicate_object then null; end $$;
