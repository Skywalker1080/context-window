"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  X,
  Tag,
  FolderOpen,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useLinks, DEFAULT_CATEGORIES } from "@/contexts/LinksContext";
import { supabase } from "@/lib/supabase";
import type { LinkItem } from "@/types";
import { LinkCard } from "./LinkCard";

type AiHit = { linkId: string; similarity: number };

export function LibraryView() {
  const { links, filteredLinks, filter, setFilter, loading, insights } =
    useLinks();
  const [showFilters, setShowFilters] = useState(false);

  const [aiSearchEnabled, setAiSearchEnabled] = useState(false);
  const [aiHits, setAiHits] = useState<AiHit[] | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const allTags = Array.from(
    new Set(insights.topTags.map((t) => t.name))
  );

  // Reset AI state whenever the toggle flips off, or the input is cleared.
  useEffect(() => {
    if (!aiSearchEnabled || !filter.search.trim()) {
      requestIdRef.current++; // invalidate any in-flight request
      setAiHits(null);
      setAiSearching(false);
      setAiError(null);
    }
  }, [aiSearchEnabled, filter.search]);

  // Fires only when the user submits (Enter / search button), not on keystroke.
  const runAiSearch = async () => {
    const query = filter.search.trim();
    if (!aiSearchEnabled || !query) return;
    const id = ++requestIdRef.current;
    setAiSearching(true);
    setAiError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setAiError("Sign in to use AI search");
        return;
      }
      const res = await fetch("/api/semantic-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });
      if (id !== requestIdRef.current) return; // stale
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAiError(body?.error || "Search failed");
        setAiHits([]);
        return;
      }
      const data = (await res.json()) as {
        results: { link_id: string; similarity: number }[];
      };
      if (id !== requestIdRef.current) return;
      setAiHits(
        data.results.map((r) => ({
          linkId: r.link_id,
          similarity: r.similarity,
        }))
      );
    } catch {
      if (id !== requestIdRef.current) return;
      setAiError("Could not reach search service");
      setAiHits([]);
    } finally {
      if (id === requestIdRef.current) setAiSearching(false);
    }
  };

  // Compose the visible list. AI mode: filter `links` by hits, sort by similarity.
  // Otherwise use the existing client-side filteredLinks.
  const visible: { link: LinkItem; similarity?: number }[] = useMemo(() => {
    if (aiSearchEnabled && aiHits) {
      const byId = new Map(links.map((l) => [l.id, l]));
      return aiHits
        .map((h) => {
          const link = byId.get(h.linkId);
          if (!link || link.status !== filter.status) return null;
          return { link, similarity: h.similarity };
        })
        .filter((x): x is { link: LinkItem; similarity: number } => x !== null);
    }
    return filteredLinks.map((link) => ({ link }));
  }, [aiSearchEnabled, aiHits, links, filter.status, filteredLinks]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
            <Image
              src="/library.svg"
              alt="Library"
              width={36}
              height={36}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Library</h2>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
              {visible.length} link{visible.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Search + AI toggle + Filter */}
      <div className="flex items-center gap-2">
        <div
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg
                      bg-surface-raised/50 border transition-colors
                      ${
                        aiSearchEnabled
                          ? "border-accent-violet/40 focus-within:border-accent-violet/60"
                          : "border-border-subtle focus-within:border-accent-violet/30"
                      }`}
        >
          {aiSearching ? (
            <Loader2
              size={14}
              className="text-accent-violet animate-spin"
            />
          ) : aiSearchEnabled ? (
            <Sparkles size={14} className="text-accent-violet" />
          ) : (
            <Search size={14} className="text-text-ghost" />
          )}
          <input
            type="text"
            value={filter.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            onKeyDown={(e) => {
              if (aiSearchEnabled && e.key === "Enter") {
                e.preventDefault();
                void runAiSearch();
              }
            }}
            placeholder={
              aiSearchEnabled
                ? "Ask in natural language, then press Enter..."
                : "Search links..."
            }
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-ghost outline-none"
          />
          {filter.search && (
            <button
              onClick={() => setFilter({ search: "" })}
              className="text-text-ghost hover:text-text-secondary transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg transition-all duration-200
            ${
              showFilters || filter.category || filter.tags.length > 0
                ? "bg-accent-violet/20 text-accent-violet"
                : "bg-surface-raised/50 text-text-muted hover:text-text-secondary"
            }`}
        >
          <Filter size={16} />
        </button>
      </div>

      {/* AI mode banner */}
      {aiSearchEnabled && (
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-accent-violet">
            <Sparkles size={10} />
            AI-powered results
          </span>
          {aiError && <span className="text-accent-rose">{aiError}</span>}
        </div>
      )}

      {/* Active filters */}
      {(filter.category || filter.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {filter.category && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                           bg-accent-violet-soft text-accent-violet text-xs font-medium"
            >
              <FolderOpen size={12} />
              {filter.category}
              <button onClick={() => setFilter({ category: null })}>
                <X size={12} />
              </button>
            </span>
          )}
          {filter.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                         bg-accent-violet-soft text-accent-violet text-xs font-medium"
            >
              #{tag}
              <button
                onClick={() =>
                  setFilter({ tags: filter.tags.filter((t) => t !== tag) })
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={() => setFilter({ category: null, tags: [] })}
            className="text-[10px] text-text-ghost hover:text-text-secondary
                       font-mono uppercase tracking-wider transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-4 space-y-4">
              <div>
                <label className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-2 flex items-center gap-1">
                  <FolderOpen size={10} />
                  Categories
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFilter({ category: null })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                      ${
                        !filter.category
                          ? "bg-accent-violet/20 text-accent-violet border border-accent-violet/30"
                          : "bg-surface-overlay text-text-muted hover:text-text-secondary border border-transparent"
                      }`}
                  >
                    All
                  </button>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() =>
                        setFilter({
                          category:
                            filter.category === cat.name ? null : cat.name,
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                        ${
                          filter.category === cat.name
                            ? "bg-accent-violet/20 text-accent-violet border border-accent-violet/30"
                            : "bg-surface-overlay text-text-muted hover:text-text-secondary border border-transparent"
                        }`}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {allTags.length > 0 && (
                <div>
                  <label className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-2 flex items-center gap-1">
                    <Tag size={10} />
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          setFilter({
                            tags: filter.tags.includes(tag)
                              ? filter.tags.filter((t) => t !== tag)
                              : [...filter.tags, tag],
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                          ${
                            filter.tags.includes(tag)
                              ? "bg-accent-violet/20 text-accent-violet border border-accent-violet/30"
                              : "bg-surface-overlay text-text-muted hover:text-text-secondary border border-transparent"
                          }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Links list */}
      <AnimatePresence mode="popLayout">
        {aiSearchEnabled && aiSearching && visible.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl shimmer" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="p-4 rounded-2xl bg-surface-raised/50 mb-4">
              {aiSearchEnabled ? (
                <Sparkles size={28} className="text-text-ghost" />
              ) : (
                <FolderOpen size={28} className="text-text-ghost" />
              )}
            </div>
            <p className="text-sm text-text-secondary">No links found</p>
            <p className="text-xs text-text-ghost mt-1">
              {aiSearchEnabled
                ? filter.search
                  ? "Try rephrasing your query"
                  : "Type a question to search semantically"
                : filter.search || filter.category || filter.tags.length > 0
                  ? "Try adjusting your filters"
                  : "Add links from your Inbox to build your library"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {visible.map(({ link, similarity }) => (
              <div key={link.id} className="relative">
                {similarity !== undefined && (
                  <span
                    className="absolute -top-1.5 right-2 z-10 px-1.5 py-0.5 rounded-md
                               text-[9px] font-mono uppercase tracking-wider
                               bg-accent-violet/20 text-accent-violet
                               ring-1 ring-accent-violet/30 backdrop-blur"
                  >
                    {Math.round(similarity * 100)}% match
                  </span>
                )}
                <LinkCard link={link} mode="library" />
              </div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
