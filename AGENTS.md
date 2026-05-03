# AI Agent Navigation Guide

## Tech Stack Context
* **Framework:** Next.js 16 (App Router)
* **Runtime:** React 19
* **Styling:** Tailwind CSS v4
* **Backend:** Supabase (Auth + Postgres + Realtime)
* **Offline cache:** IndexedDB via `idb` (replaces Firestore's `persistentLocalCache`)
* **Architecture:** Structured as an SPA (Single Page Application) within Next.js. Most components require `"use client"` because of Supabase realtime subscriptions and browser-only auth state.

## Project Structure & Key Paths

### Core Configuration
* `app/page.tsx` — **Entry Point.** Dynamically imports `AppShell` with `ssr: false` to keep the app fully client-rendered.
* `app/layout.tsx` — **Root Layout.** Contains PWA metadata and font configuration.
* `app/globals.css` — **Design System.** Contains all custom Tailwind v4 `@theme` variables (fonts, colors) and core `.glass` utility classes. Do not use Tailwind config files; use this CSS file instead.
* `lib/supabase.ts` — **Supabase browser client** (PKCE flow, persistent sessions).
* `lib/offline-cache.ts` — **IndexedDB wrapper** for offline reads of links and collections.
* `supabase/migrations/` — **Schema source of truth.** Manage with the Supabase CLI (`npx supabase migration new …`, `npx supabase db push`).
* `types/index.ts` — **TypeScript Definitions.** Central location for all shared interfaces (LinkItem, Collection, etc.).

### Contexts & State (The "Brain")
* `contexts/AuthContext.tsx` — Handles Google/Email login state. Exposes `useAuth()` returning an `AppUser` shape with `{ uid, email, displayName, photoURL, provider }` (mapped from the Supabase user via `mapUser()`).
* `contexts/LinksContext.tsx` — **Core Logic.** Supabase queries + Realtime channel + IndexedDB cache mirror. Links carry a `collectionIds: string[]` field (stored as `collection_ids uuid[]` in Postgres).
* `contexts/CollectionsContext.tsx` — **Collections Logic.** Same pattern. `deleteCollection` calls the `remove_collection_id_from_links` Postgres RPC to scrub array refs atomically before the row is deleted.

### API Routes
* `app/api/scrape/route.ts` — **Scraping Proxy.** Forwards metadata extraction requests to a standalone Railway service.

### UI Components (`/components`)
* `AppShell.tsx` — Gatekeeper (Auth check).
* `Dashboard.tsx` — Layout wrapper with sidebar logic.
* `Sidebar.tsx` — Navigation menu. Uses `user.provider === "google"` to detect Google sign-in.
* `LinkCard.tsx` — Main repeatable card for URLs.
* `InboxQueue.tsx` / `LibraryView.tsx` — Primary data views.
* `CollectionView.tsx` — Filtered view for specific collections.
* `AuthPage.tsx` — Sign-in / sign-up. Maps Supabase error messages to user-friendly copy.

### PWA Assets
* `app/manifest.ts` — Web App Manifest.
* `public/sw.js` — **Service Worker.** Network-first; bypasses Supabase and `/api/scrape`. Versioned via `CACHE_NAME` (currently `v6`). Bump this version when making major UI or caching logic changes.

## Guidelines for Agents
1. **Styling:** Rely on custom variables in `app/globals.css` (e.g., `text-accent-violet`, `bg-void`, `glass`).
2. **Icons:** Use `lucide-react`.
3. **Animations:** Use `framer-motion` (`motion.div`, `AnimatePresence`).
4. **Data Fetching:** Do not use Server Components for data. All Supabase data comes from `useLinks()` and `useCollections()`.
5. **Security Pattern (CRITICAL):** Postgres Row-Level Security enforces `auth.uid() = user_id` on every row. The client does NOT need to add `eq("user_id", uid)` to writes — RLS will reject. For reads, you should still add `.eq("user_id", uid)` to keep the query plan tight, and Realtime channels MUST include `filter: 'user_id=eq.<uid>'` for socket efficiency.
6. **Mutations on `collection_ids`:** It is a `uuid[]` array. To mutate, read-modify-write the array client-side. To scrub a single id from many links (e.g., on collection delete), call the `remove_collection_id_from_links` RPC.
7. **Schema changes:** Always go through `npx supabase migration new <name>` and `npx supabase db push`. Never modify tables in the dashboard for production schema.
8. **Realtime + RLS:** Tables must be added to the `supabase_realtime` publication AND have RLS policies granting select. The initial migration handles both for `links` and `collections`.
9. **Offline cache:** Every realtime event mirrors the new state into IndexedDB via `cacheLinks` / `cacheCollections`. On context mount, IndexedDB is read first to seed React state instantly; the fresh `select()` then overwrites once it lands.

## Future Work
* **pgvector / AI agents.** When the AI agent feature lands, add a separate migration that runs `create extension if not exists vector;` and adds an `embedding vector(N)` column or a sibling `link_embeddings` table.

## Local Backup Tooling (Not Runtime)
* `scripts/export-firestore.mjs` and the `firebase-admin` devDependency exist solely for one-off Firestore exports during the migration. Not part of the runtime path. Remove only when the user confirms the offline backup is no longer needed.
