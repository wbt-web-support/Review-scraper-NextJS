-- Move any database that got an earlier draft of the first-step copy onto the
-- wording we settled on.
--
-- The step shipped with placeholder wording that went through two revisions before
-- Daniel wrote the version now in 20260813000000. A database migrated during that
-- window holds one of the drafts; a fresh one already has the final text and this
-- file changes nothing.
--
-- Each UPDATE is conditional on the row still holding a draft verbatim, so a
-- business that has written their own copy keeps every word of it.

alter table public.collection_settings
  alter column intro_title set default 'We value your feedback';

alter table public.collection_settings
  alter column intro_body set default 'Client recommendations are at the heart of what we do.

We would be incredibly grateful if you could take 60 seconds to record a quick, unscripted video review of our work together.

Thank you!';

update public.collection_settings
   set intro_title = default
 where btrim(intro_title) = 'Share a video review';

-- Draft one, which was lifted near-verbatim from another product.
update public.collection_settings
   set intro_body = default
 where btrim(intro_body) = btrim('Our business thrives on the quality of the work we do and the customers who recommend us to others.

We would really appreciate it if you could take a minute to talk through your experience.

The more natural and honest, the better.

Thank you!');

-- Draft two, rewritten in our own words but too casual for a client's page.
update public.collection_settings
   set intro_body = default
 where btrim(intro_body) = btrim('We''re built on the quality of our work and the customers who pass our name on.

If you can spare a minute, tell us how it went.

Say it how you''d say it in person. Unpolished is fine.

Thank you.');

-- Draft three, more formal but still ours rather than the client's.
update public.collection_settings
   set intro_body = default
 where btrim(intro_body) = btrim('Our reputation is built on the quality of our work and the customers who recommend us.

If you have a minute, we''d value hearing about your experience.

There''s no script to follow. Speak naturally, in your own words.

Thank you.');
