"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Tag,
  FolderOpen,
  Sparkles,
  Loader2,
  ArrowUp,
  ImagePlus,
} from "lucide-react";
import { useLinks, DEFAULT_CATEGORIES } from "@/contexts/LinksContext";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { OfflineError } from "@/lib/offline";
import { parseQuickCapture } from "@/lib/quick-capture";
import { RejectedImageError, isDirectImageUrl, importImageUrl } from "@/lib/images";
import type { LinkItem } from "@/types";
import { SavedLinkCard } from "./SavedLinkCard";
import { ImageCard } from "./ImageCard";

type AiHit = { linkId: string; similarity: number };

interface LibraryViewProps {
  onOpenDetail?: (linkId: string) => void;
}

export function LibraryView({ onOpenDetail }: LibraryViewProps = {}) {
  const { links, filteredLinks, filter, setFilter, loading, insights, addLink, addImageFile, inboxLinks, inboxFull } =
    useLinks();
  const [aiSearchEnabled, setAiSearchEnabled] = useState(false);
  const [aiHits, setAiHits] = useState<AiHit[] | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optimistic uploads: blob previews visible in this tab only until the
  // server row lands via upsertLocal (same tab) or Realtime (other tabs).
  const [pending, setPending] = useState<
    { key: string; url: string; name: string }[]
  >([]);
  const [dragging, setDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;
    for (const file of list) {
      const key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      const url = URL.createObjectURL(file);
      setPending((prev) => [...prev, { key, url, name: file.name }]);
      try {
        const item = await addImageFile(file);
        showToast({
          kind: "success",
          title: item.title
            ? `Saved ${item.title}`
            : "Image saved to library",
        });
      } catch (err) {
        if (err instanceof OfflineError) {
          // Global toast already surfaced the offline message.
        } else if (err instanceof RejectedImageError) {
          showToast({ kind: "error", title: err.message });
        } else {
          showToast({
            kind: "error",
            title: err instanceof Error ? err.message : "Failed to save image",
          });
        }
      } finally {
        URL.revokeObjectURL(url);
        setPending((prev) => prev.filter((p) => p.key !== key));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      void uploadFiles(files);
    }
  };

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

  // If the search text starts with a pasted link ("URL [optional note]"),
  // capture it straight to the queue instead of searching. Returns true when handled.
  const capturePastedLink = async (): Promise<boolean> => {
    const parsed = parseQuickCapture(filter.search);
    if (!parsed) return false;
    // Direct image URLs skip the inbox queue and land in the library.
    if (isDirectImageUrl(parsed.url)) {
      try {
        const { deduped } = await importImageUrl(parsed.url, { note: parsed.note });
        showToast({
          kind: "success",
          title: deduped ? "Image already in library" : "Image saved to library",
        });
        setFilter({ search: "" });
      } catch (err) {
        if (!(err instanceof OfflineError)) {
          showToast({
            kind: "error",
            title: err instanceof Error ? err.message : "Failed to save image",
          });
        }
      }
      return true;
    }
    try {
      await addLink(parsed.url, parsed.note, []);
      showToast({ kind: "success", title: "Link captured to queue" });
      setFilter({ search: "" });
    } catch (err) {
      if (err instanceof OfflineError) {
        // Global toast already surfaced the offline message.
      } else {
        showToast({
          kind: "error",
          title: err instanceof Error ? err.message : "Failed to capture link",
        });
      }
    }
    return true;
  };

  // Shared submit for Enter key and the send button: pasted links go to the
  // queue, otherwise (in AI mode) run a semantic search.
  const submitSearch = () => {
    void (async () => {
      if (await capturePastedLink()) return;
      if (aiSearchEnabled) void runAiSearch();
    })();
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
    <div
      className="space-y-4 relative"
      onPaste={handlePaste}
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer?.types.includes("Files")) {
          dragDepthRef.current++;
          setDragging(true);
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepthRef.current = 0;
        setDragging(false);
        if (e.dataTransfer?.files.length) void uploadFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent-violet/60 bg-accent-violet/10 backdrop-blur-[1px]">
          <p className="text-sm font-medium text-accent-violet">
            Drop images to save to library
          </p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
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

        {/* Search + capture */}
        <div
          className={`flex-1 min-w-[220px] flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full
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
              className="text-accent-violet animate-spin flex-shrink-0"
            />
          ) : aiSearchEnabled ? (
            <Sparkles size={14} className="text-accent-violet flex-shrink-0" />
          ) : (
            <Search size={14} className="text-text-ghost flex-shrink-0" />
          )}
          <input
            type="text"
            value={filter.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              submitSearch();
            }}
            placeholder={
              aiSearchEnabled
                ? "Ask in natural language, then press Enter..."
                : "Search or Capture links"
            }
            className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder-text-ghost outline-none"
          />
          {filter.search && (
            <button
              onClick={() => setFilter({ search: "" })}
              className="text-text-ghost hover:text-text-secondary transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
          <div
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold flex-shrink-0
              ${inboxFull ? "bg-accent-amber-soft text-accent-amber" : "bg-accent-violet-soft text-accent-violet"}`}
          >
            {inboxLinks.length}/9
          </div>
          <button
            onClick={submitSearch}
            title="Search or capture link"
            className="p-1.5 rounded-full bg-accent-violet/20 text-accent-violet
                       hover:bg-accent-violet/30 transition-all duration-200 flex-shrink-0"
          >
            <ArrowUp size={14} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload images (or drag & drop anywhere here)"
            className="p-1.5 rounded-full text-text-ghost hover:text-accent-violet
                       hover:bg-accent-violet/10 transition-all duration-200 flex-shrink-0"
          >
            <ImagePlus size={14} />
          </button>
        </div>
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

      {/* Always-visible filters */}
      <section className="space-y-4 px-1">
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
      </section>

      {/* Card library */}
      <AnimatePresence mode="popLayout">
        {aiSearchEnabled && aiSearching && visible.length === 0 ? (
          <div className="link-card-grid">
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
          <div className="link-card-grid">
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
                {link.kind === "image" ? (
                  <ImageCard link={link} onOpenDetail={onOpenDetail ? (l) => onOpenDetail(l.id) : undefined} />
                ) : (
                  <>
                    <SavedLinkCard link={link} onOpenDetail={onOpenDetail ? (l) => onOpenDetail(l.id) : undefined} />
                    {link.note && (
                      <p
                        title={link.note}
                        className="mt-2 truncate px-1 text-[11px] leading-4 text-accent-violet/85"
                      >
                        {link.note}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
            {pending.map((p) => (
              <div
                key={p.key}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#20201f] aspect-square"
              >
                <img
                  src={p.url}
                  alt={p.name}
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 size={20} className="text-white animate-spin" />
                </div>
              </div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
