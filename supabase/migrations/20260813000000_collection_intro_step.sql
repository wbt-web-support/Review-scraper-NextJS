-- The collection page's first step: the ask, before the brief.
--
-- The page used to open on the prompt questions and a record button, which is a
-- list of work before anyone has agreed to do any. It now opens on a short ask,
-- and the questions arrive on step two once the customer has said yes.
--
-- These two columns are that first screen's words, so a business can change them
-- the same way they already change the welcome text and the prompts.
--
-- NOT NULL with defaults, deliberately: every existing tenant gets working copy
-- the moment this runs, rather than a blank first screen until someone thinks to
-- fill it in.

alter table public.collection_settings
  add column if not exists intro_title text not null
    default 'We value your feedback',
  add column if not exists intro_body text not null
    default 'Client recommendations are at the heart of what we do.

We would be incredibly grateful if you could take 60 seconds to record a quick, unscripted video review of our work together.

Thank you!';

-- One paragraph per blank line, so the textarea in settings maps to what renders
-- with no markup for a non-technical user to get wrong.
comment on column public.collection_settings.intro_body is
  'Body copy for the collection page''s first step. Blank lines separate paragraphs.';
