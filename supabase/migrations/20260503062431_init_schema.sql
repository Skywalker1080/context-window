-- Initial schema for Context Window: links + collections with RLS and Realtime.

-- collections
create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- links
create table public.links (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  url             text not null,
  title           text not null default '',
  description     text not null default '',
  favicon         text not null default '',
  note            text not null default '',
  status          text not null default 'inbox'
                    check (status in ('inbox','library','deleted')),
  category        text not null default 'Website',
  tags            text[] not null default '{}',
  collection_ids  uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- indexes
create index links_user_created_idx       on public.links (user_id, created_at desc);
create index links_collection_ids_gin     on public.links using gin (collection_ids);
create index collections_user_created_idx on public.collections (user_id, created_at);

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger links_updated       before update on public.links
  for each row execute function public.set_updated_at();
create trigger collections_updated before update on public.collections
  for each row execute function public.set_updated_at();

-- Data API access (RLS still gates per-row visibility below).
grant select, insert, update, delete on public.links       to authenticated;
grant select, insert, update, delete on public.collections to authenticated;

-- RLS
alter table public.links       enable row level security;
alter table public.collections enable row level security;

create policy "links_select" on public.links for select
  using (auth.uid() = user_id);
create policy "links_insert" on public.links for insert
  with check (auth.uid() = user_id);
create policy "links_update" on public.links for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "links_delete" on public.links for delete
  using (auth.uid() = user_id);

create policy "collections_select" on public.collections for select
  using (auth.uid() = user_id);
create policy "collections_insert" on public.collections for insert
  with check (auth.uid() = user_id);
create policy "collections_update" on public.collections for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collections_delete" on public.collections for delete
  using (auth.uid() = user_id);

-- Realtime publication
alter publication supabase_realtime add table public.links;
alter publication supabase_realtime add table public.collections;

-- RPC for collection deletion (atomic scrub of array refs in caller's own links)
create or replace function public.remove_collection_id_from_links(p_collection_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.links
     set collection_ids = array_remove(collection_ids, p_collection_id)
   where user_id = auth.uid()
     and p_collection_id = any(collection_ids);
$$;

grant execute on function public.remove_collection_id_from_links(uuid) to authenticated;
