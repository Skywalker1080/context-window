# AI Agent Navigation Guide

## Tech Stack Context
* **Framework:** Next.js 16 (App Router)
* **Styling:** Tailwind CSS v4
* **Backend:** Firebase (Auth + Firestore)
* **Architecture:** Structured as an SPA (Single Page Application) within Next.js. Most components require `"use client"` because of Firebase hooks.

## Project Structure & Key Paths

### Core Configuration
* `app/page.tsx` — **Entry Point.** Dynamically imports `AppShell` with `ssr: false` to prevent Server-Side Rendering issues with Firebase.
* `app/layout.tsx` — **Root Layout.** Contains PWA metadata and font configuration.
* `app/globals.css` — **Design System.** Contains all custom Tailwind v4 `@theme` variables (fonts, colors) and core `.glass` utility classes. Do not use Tailwind config files; use this CSS file instead.
* `lib/firebase.ts` — **Database Init.** Configured with `persistentLocalCache` for instant offline loading.

### Contexts & State (The "Brain")
* `contexts/AuthContext.tsx` — Handles Google/Email login state.
* `contexts/LinksContext.tsx` — **Core Logic.** Handles Firestore CRUD, Inbox/Library tagging, and offline fetching. Links now carry a `collectionIds: string[]` field.
* `contexts/CollectionsContext.tsx` — **Collections Logic.** Handles Firestore CRUD for user collections (`collections` top-level collection). Provides `addLinkToCollection` / `removeLinkFromCollection` via `arrayUnion` / `arrayRemove`.

### API Routes
* `app/api/scrape/route.ts` — **Scraping Proxy.** Forwards metadata extraction requests to a standalone Railway service running Fastify and Metascraper.

### UI Components (`/components`)
* `AppShell.tsx` — The main gatekeeper. Shows `AuthPage` if unauthenticated, or `Dashboard` if logged in.
* `Dashboard.tsx` — The main layout wrapper with mobile/desktop sidebar logic.
* `Sidebar.tsx` — Navigation menu controlling which view is active.
* `CaptureBar.tsx` — The fast-entry input for saving new URLs.
* `LinkCard.tsx` — The main repeatable card component for displaying URLs (with triage actions).
* `InboxQueue.tsx` / `LibraryView.tsx` — The two primary data views mapping over `LinkCard`.
* `CollectionView.tsx` — Displays links within a user-created collection. Supports search and inline rename.
* `InsightsPanel.tsx` — The analytics view showing UI charts and top tags.

### PWA Assets
* `app/manifest.ts` — Generates the Web App Manifest.
* `public/sw.js` — Service Worker handling network/cache strategies and offline fallbacks.

## Guidelines for Agents
1. **Styling:** Rely on the custom colors (e.g., `text-accent-violet`, `bg-void`, `glass`) defined in `app/globals.css`. 
2. **Icons:** Use `lucide-react`.
3. **Animations:** Use `framer-motion` (`motion.div`, `AnimatePresence`).
4. **Data Fetching:** Do not use Server Components for data. All Firebase data comes from `useLinks()` and `useCollections()` in Client Components.
