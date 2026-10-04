-- Worker + sweep lookups for image originals.
-- The variant worker finds unprocessed images via the thumbnail column:
-- inserts leave thumbnail='' and the worker fills it with the display URL.
-- (First-class predicate, no JSONB filter needed.)

create index links_image_unprocessed_idx on public.links (created_at)
  where kind = 'image' and status = 'library' and thumbnail = '';
