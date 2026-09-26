"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  FolderOpen,
  Pencil,
  Check,
  ArrowUp,
} from "lucide-react";
import { useLinks } from "@/contexts/LinksContext";
import { useCollections } from "@/contexts/CollectionsContext";
import { showToast } from "@/lib/toast";
import { OfflineError } from "@/lib/offline";
import { parseQuickCapture } from "@/lib/quick-capture";
import { SavedLinkCard } from "./SavedLinkCard";

interface CollectionViewProps {
  collectionId: string;
}

export function CollectionView({ collectionId }: CollectionViewProps) {
  const { links, loading, addLink, inboxLinks, inboxFull } = useLinks();
  const { collections, renameCollection } = useCollections();
  const [search, setSearch] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const currentCollection = collections.find((c) => c.id === collectionId);

  const collectionLinks = useMemo(() => {
    return links.filter(
      (l) =>
        l.status === "library" &&
        l.collectionIds.includes(collectionId)
    );
  }, [links, collectionId]);

  const filteredLinks = useMemo(() => {
    if (!search) return collectionLinks;
    const q = search.toLowerCase();
    return collectionLinks.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.note.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [collectionLinks, search]);

  const startRename = () => {
    setRenameValue(currentCollection?.name || "");
    setIsRenaming(true);
  };

  const confirmRename = async () => {
    if (renameValue.trim() && currentCollection) {
      await renameCollection(currentCollection.id, renameValue);
    }
    setIsRenaming(false);
  };

  // A pasted link ("URL [optional note]") + Enter captures straight to the queue.
  const capturePastedLink = async (): Promise<boolean> => {
    const parsed = parseQuickCapture(search);
    if (!parsed) return false;
    try {
      await addLink(parsed.url, parsed.note, []);
      showToast({ kind: "success", title: "Link captured to queue" });
      setSearch("");
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

  // Shared submit for Enter key and the send button: pasted links go to the queue.
  const submitSearch = () => {
    void capturePastedLink();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  if (!currentCollection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-2xl bg-surface-raised/50 mb-4">
          <FolderOpen size={28} className="text-text-ghost" />
        </div>
        <p className="text-sm text-text-secondary">Board not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-accent-violet-soft flex items-center justify-center">
            <FolderOpen size={18} className="text-accent-violet" />
          </div>
          <div>
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename();
                    if (e.key === "Escape") setIsRenaming(false);
                  }}
                  autoFocus
                  className="bg-surface-raised/50 border border-border-subtle rounded-lg
                             px-2 py-1 text-sm text-text-primary placeholder-text-ghost
                             outline-none focus:border-accent-violet/30 transition-colors"
                />
                <button
                  onClick={confirmRename}
                  className="p-1 rounded-md bg-accent-violet/20 text-accent-violet
                             hover:bg-accent-violet/30 transition-colors"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/rename">
                <h2 className="text-sm font-semibold text-text-primary">
                  {currentCollection.name}
                </h2>
                <button
                  onClick={startRename}
                  className="p-1 rounded-md text-text-ghost opacity-0 group-hover/rename:opacity-100
                             hover:text-text-secondary hover:bg-surface-overlay transition-all duration-200"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
              {collectionLinks.length} card
              {collectionLinks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Search + capture */}
        <div
          className="flex-1 min-w-[220px] flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full
                     bg-surface-raised/50 border border-border-subtle
                     focus-within:border-accent-violet/30 transition-colors"
        >
          <Search size={14} className="text-text-ghost flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              submitSearch();
            }}
            placeholder="Search or Capture links"
            className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder-text-ghost outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
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
        </div>
      </div>

      {/* Board card grid */}
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
            <p className="text-sm text-text-secondary">
              {search
                ? "No matching cards"
                : "This board is empty"}
            </p>
            <p className="text-xs text-text-ghost mt-1">
              {search
                ? "Try adjusting your search"
                : "Add links from your Library using the card menu"}
            </p>
          </motion.div>
        ) : (
          <div className="link-card-grid pb-12">
            {filteredLinks.map((link) => (
              <div key={link.id}>
                <SavedLinkCard link={link} activeCollectionId={collectionId} />
                {link.note && (
                  <p
                    title={link.note}
                    className="mt-2 truncate px-1 text-[11px] leading-4 text-accent-violet/85"
                  >
                    {link.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
