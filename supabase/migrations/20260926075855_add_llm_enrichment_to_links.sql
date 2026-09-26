-- Add LLM-enrichment columns to links: AI summary, suggested tags, and status tracking.
-- The semantic-search/scraper services write these via the service role; users only read.

alter table public.links
  add column summary text not null default '',
  add column suggested_tags text[] not null default '{}',
  add column enrichment_status text not null default 'pending'
    check (enrichment_status in ('pending', 'enriching', 'done', 'failed')),
  add column enriched_at timestamptz;

-- Partial index for finding pending/enriching links (retry sweeps, dashboards).
create index links_enrichment_status_idx on public.links (enrichment_status)
  where enrichment_status in ('pending', 'enriching');

-- No new RLS policy: existing links_select covers reads. We intentionally do NOT
-- restrict writes to these columns at the DB level (per plan); the client simply
-- never writes them, and the scraper service uses the service role which bypasses RLS.
