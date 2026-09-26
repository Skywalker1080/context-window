-- Grant UPDATE on links to service_role so the scraper service can write
-- LLM enrichment results (summary, suggested_tags, enrichment_status, enriched_at).
-- SELECT was already granted in 20260510000000_add_pgvector_embeddings.sql.
--
-- RLS still applies at the policy level for non-service-role callers; service_role
-- bypasses RLS by design, which is what we want here.

grant update on public.links to service_role;
