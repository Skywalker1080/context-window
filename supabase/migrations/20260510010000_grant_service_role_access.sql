-- Follow-up to 20260510000000_add_pgvector_embeddings.sql.
--
-- The initial schema only granted DML on `links` to `authenticated`. The
-- semantic-search microservice connects with the service role key, so it also
-- needs explicit grants on `links` (read) and `link_embeddings` (full DML).
--
-- This is a separate migration because Supabase tracks migrations by version
-- prefix; editing the original file after `db push` does not re-apply it.

grant select on public.links to service_role;

grant select, insert, update, delete on public.link_embeddings to service_role;
