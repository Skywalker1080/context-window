-- Thumbnail (og:image / oEmbed) for link card covers.
alter table public.links
  add column if not exists thumbnail text not null default '';
