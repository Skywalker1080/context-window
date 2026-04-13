"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  X,
  Tag,
  FolderOpen,
} from "lucide-react";
import { useLinks, DEFAULT_CATEGORIES } from "@/contexts/LinksContext";
import { LinkCard } from "./LinkCard";
import type { LinkStatus } from "@/types";

export function LibraryView() {
  const { filteredLinks, filter, setFilter, loading, insights } = useLinks();
  const [showFilters, setShowFilters] = useState(false);

  const allTags = Array.from(
    new Set(insights.topTags.map((t) => t.name))
  );

  const statusTabs: {
    label: string;
    value: LinkStatus;
  }[] = [
    { label: "Library", value: "library" },
    { label: "Archived", value: "archived" },
  ];

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
              {filteredLinks.length} link
              {filteredLinks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-surface-raised/50">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter({ status: tab.value })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                         transition-all duration-200 flex-1 justify-center
              ${
                filter.status === tab.value
                  ? "bg-surface-overlay text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
          >
             {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg
                        bg-surface-raised/50 border border-border-subtle
                        focus-within:border-accent-violet/30 transition-colors"
        >
          <Search size={14} className="text-text-ghost" />
          <input
            type="text"
            value={filter.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            placeholder="Search links..."
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
        {filteredLinks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="p-4 rounded-2xl bg-surface-raised/50 mb-4">
              <FolderOpen size={28} className="text-text-ghost" />
            </div>
            <p className="text-sm text-text-secondary">No links found</p>
            <p className="text-xs text-text-ghost mt-1">
              {filter.search || filter.category || filter.tags.length > 0
                ? "Try adjusting your filters"
                : "Add links from your Inbox to build your library"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredLinks.map((link) => (
              <LinkCard key={link.id} link={link} mode="library" />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
