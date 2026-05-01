# AI Agent Navigation Guide

## Tech Stack Context
* **Framework:** Next.js 16 (App Router)
* **Runtime:** React 19
* **Styling:** Tailwind CSS v4
* **Backend:** Firebase (Auth + Firestore)
* **Architecture:** Structured as an SPA (Single Page Application) within Next.js. Most components require `"use client"` because of Firebase hooks.

## Project Structure & Key Paths

### Core Configuration
* `app/page.tsx` — **Entry Point.** Dynamically imports `AppShell` with `ssr: false` to prevent Server-Side Rendering issues with Firebase.
* `app/layout.tsx` — **Root Layout.** Contains PWA metadata and font configuration.
* `app/globals.css` — **Design System.** Contains all custom Tailwind v4 `@theme` variables (fonts, colors) and core `.glass` utility classes. Do not use Tailwind config files; use this CSS file instead.
* `lib/firebase.ts` — **Database Init.** Configured with `persistentLocalCache` for instant offline loading.
* `firestore.rules` — **Security Rules.** Explicitly separated into read, create, update, and delete rules. Enforces `userId` ownership.
* `types/index.ts` — **TypeScript Definitions.** Central location for all shared interfaces (LinkItem, Collection, etc.).

### Contexts & State (The "Brain")
* `contexts/AuthContext.tsx` — Handles Google/Email login state.
* `contexts/LinksContext.tsx` — **Core Logic.** Handles Firestore CRUD, Inbox/Library tagging, and offline fetching. Links carry a `collectionIds: string[]` field.
* `contexts/CollectionsContext.tsx` — **Collections Logic.** Handles Firestore CRUD for user collections. Provides `addLinkToCollection` / `removeLinkFromCollection`.

### API Routes
* `app/api/scrape/route.ts` — **Scraping Proxy.** Forwards metadata extraction requests to a standalone Railway service.

### UI Components (`/components`)
* `AppShell.tsx` — Gatekeeper (Auth check).
* `Dashboard.tsx` — Layout wrapper with sidebar logic.
* `Sidebar.tsx` — Navigation menu.
* `LinkCard.tsx` — Main repeatable card for URLs.
* `InboxQueue.tsx` / `LibraryView.tsx` — Primary data views.
* `CollectionView.tsx` — Filtered view for specific collections.

### PWA Assets
* `app/manifest.ts` — Web App Manifest.
* `public/sw.js` — **Service Worker.** Handles caching. Versioned via `CACHE_NAME` (currently `v4`). Bump this version when making major UI or caching logic changes.

## Guidelines for Agents
1. **Styling:** Rely on custom variables in `app/globals.css` (e.g., `text-accent-violet`, `bg-void`, `glass`).
2. **Icons:** Use `lucide-react`.
3. **Animations:** Use `framer-motion` (`motion.div`, `AnimatePresence`).
4. **Data Fetching:** Do not use Server Components for data. All Firebase data comes from `useLinks()` and `useCollections()`.
5. **Security Pattern (CRITICAL):** Firestore rules enforce `userId` ownership. Every query MUST include a `.where("userId", "==", user.uid)` clause to be permitted, even if the result seems logically implicit.
6. **Mutations:** When deleting collections, ensure you also clean up link references using `writeBatch` and `arrayRemove`.
