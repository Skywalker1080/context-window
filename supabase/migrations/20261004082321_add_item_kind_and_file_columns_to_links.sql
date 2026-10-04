-- Item kinds on links: images now, Notion-like documents in v2.
-- Images and documents insert straight to library (status='library'),
-- bypassing the inbox queue. Binary bytes live in S3; Postgres keeps
-- pointers + layout fields + flexible per-kind metadata in JSONB.

alter table public.links
  add column kind text not null default 'link'
    check (kind in ('link', 'image', 'document')),
  add column file_key text,
  add column mime_type text,
  add column width int check (width is null or width > 0),
  add column height int check (height is null or height > 0),
  add column size_bytes int check (size_bytes is null or size_bytes > 0),
  add column metadata jsonb not null default '{}';

-- Library listing by kind (cards filter on kind + status).
create index links_kind_status_idx on public.links (user_id, kind, status, created_at desc);

-- Sweep support: nightly job finds long-deleted rows holding S3 keys.
create index links_deleted_file_idx on public.links (updated_at)
  where status = 'deleted' and file_key is not null;

-- No new RLS policy: existing links_select/insert/update/delete policies
-- already scope to auth.uid() = user_id and cover the new columns.
-- No Realtime change needed: publication is per-table, new columns replicate.
