# AGENTS.md

## Stack
Next.js 16 (App Router) · React 19 · Tailwind v4 (`app/globals.css` `@theme`, no config files) · Supabase (Auth + Postgres + Realtime) · IndexedDB via `idb` for offline cache. SPA-in-Next.js: most components are `"use client"` (realtime + browser auth state). Entry `app/page.tsx` imports `AppShell` with `ssr: false`.

## Key paths
- `contexts/LinksContext.tsx` — core state: Supabase + Realtime + IndexedDB mirror. Owns ALL `links`-table mutations (`addLink`, `triageLink`, `updateLink`, `deleteLink`, `addLinkToCollection`, `removeLinkFromCollection`, `removeCollectionFromAllLinks`).
- `contexts/CollectionsContext.tsx` — collections state. Delegates link-membership ops to `useLinks()`. `CollectionsProvider` MUST mount inside `LinksProvider`.
- `lib/offline.ts` — `assertOnline(action)` + `OfflineError`. `lib/toast.ts` — `showToast()`. `lib/offline-cache.ts` — IndexedDB mirror.
- `types/index.ts` — shared types. `supabase/migrations/` — schema source of truth.
- `app/api/scrape|embed|semantic-search|backfill-embeddings/route.ts` — proxies to backend services (auth patterns below).
- `infrastructure/` — CDK stack `ContextWindowScraperStack` (us-east-1): ECR + ECS Fargate (1× 0.25vCPU/0.5GB, always-on) + ALB. `scraper-service/` — Fastify service source (separate repo, gitignored here).

## Strict rules
1. **Data:** no Server Components for data. Everything via `useLinks()` / `useCollections()`.
2. **RLS:** `auth.uid() = user_id` enforced in Postgres. No `eq("user_id")` on writes; keep it on reads; Realtime channels MUST filter `user_id=eq.<uid>`.
3. **Mutations:** `assertOnline()` BEFORE any optimistic change → apply locally (`upsertLocal`/`removeLocal`) → write with `.select("*").single()` → re-apply server row. Swallow `OfflineError` where global toast already covers it.
4. **`collection_ids` (`uuid[]`):** read-modify-write client-side; scrub via `remove_collection_id_from_links` RPC + `removeCollectionFromAllLinks()`.
5. **Schema:** only via `npx supabase migration new` + `db push`. Never dashboard-edit prod. New tables need `supabase_realtime` publication + select RLS policy.
6. **Cache mirror:** every realtime event writes through to IndexedDB; contexts seed from IndexedDB first, then overwrite with fresh `select()`.
7. **Styling/icons/motion:** glass tokens from `globals.css`, `lucide-react`, `framer-motion` only.
8. **Proxies:** `/api/scrape` → Fargate ALB (`SCRAPER_SERVICE_URL`, `X-API-KEY: $API_SECRET`); `/api/embed|semantic-search|backfill` → semantic-search microservice (Bearer user token in, `X-API-KEY` out). Embed calls are fire-and-forget.
9. **Embeddings:** text = `title + description + note + tags` (never URL); content-hash idempotent; `link_embeddings` has SELECT-only RLS, writes via service role.
10. **Secrets:** never commit. Scraper `API_SECRET` lives in SSM `/context-window-scraper/api-secret`, injected as ECS secret. Frontend env in Vercel + `.env.local`.
11. **PWA:** bump `CACHE_NAME` in `public/sw.js` on major UI/caching changes; bump version string when adding `ChangelogView` entries.
12. **Build:** root `tsconfig.json` excludes `scraper-service/` + `infrastructure/` — `next build` type-checks the root, keep those excludes.
13. **Local backup:** `scripts/export-firestore.mjs` + `firebase-admin` are migration-only, not runtime. Don't remove without confirmation.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for Skywalker1080/context-window (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels, each equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
