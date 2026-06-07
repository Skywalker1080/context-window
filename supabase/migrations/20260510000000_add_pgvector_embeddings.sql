-- Add pgvector + link_embeddings table for AI-powered semantic search.
-- Embeddings are stored in a sibling table (not on `links`) so realtime
-- subscriptions and IndexedDB caches stay lean.
--
-- Hosted Supabase installs pgvector into the `extensions` schema, so the
-- vector type, opclass, and operators must be schema-qualified (or the
-- search_path widened) wherever they appear.

create extension if not exists vector with schema extensions;

-- The semantic-search microservice connects with the service role key.
-- The initial schema only granted DML to `authenticated`; service_role needs
-- explicit grants to read links and write embeddings.
grant select on public.links to service_role;

create table public.link_embeddings (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid not null unique references public.links(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  embedding    extensions.vector(768) not null,
  content_hash text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

grant select, insert, update, delete on public.link_embeddings to service_role;

create index link_embeddings_user_idx on public.link_embeddings (user_id);
create index link_embeddings_cosine_idx
  on public.link_embeddings using hnsw (embedding extensions.vector_cosine_ops);

create trigger link_embeddings_updated before update on public.link_embeddings
  for each row execute function public.set_updated_at();

-- The Python service connects with the service role key and bypasses RLS, but
-- we still enable it so the anon key cannot read other users' vectors.
alter table public.link_embeddings enable row level security;

create policy "link_embeddings_select" on public.link_embeddings for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for `authenticated` — only the service role
-- (used by the microservice) is allowed to mutate this table.

-- Similarity search RPC. The `<=>` cosine-distance operator lives in the
-- `extensions` schema, so the function's search_path must include it.
create or replace function public.match_links(
  query_embedding extensions.vector(768),
  p_user_id       uuid,
  match_threshold float default 0.5,
  match_count     int   default 10
)
returns table (
  link_id    uuid,
  similarity float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    le.link_id,
    1 - (le.embedding <=> query_embedding) as similarity
  from public.link_embeddings le
  where le.user_id = p_user_id
    and 1 - (le.embedding <=> query_embedding) >= match_threshold
  order by le.embedding <=> query_embedding asc
  limit match_count
$$;

-- Only the service role may call this RPC. The function takes p_user_id as a
-- parameter (not auth.uid()), so granting it to `authenticated` would let any
-- signed-in browser query another user's link_ids by passing their uuid.
revoke all on function public.match_links(extensions.vector, uuid, float, int) from public;
grant execute on function public.match_links(extensions.vector, uuid, float, int)
  to service_role;
