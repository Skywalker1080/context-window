"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  FolderOpen,
  Pencil,
  Check,
} from "lucide-react";
import { useLinks } from "@/contexts/LinksContext";
import { useCollections } from "@/contexts/CollectionsContext";
import { LinkCard } from "./LinkCard";

interface CollectionViewProps {
  collectionId: string;
}

export function CollectionView({ collectionId }: CollectionViewProps) {
  const { links, loading } = useLinks();
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
        <p className="text-sm text-text-secondary">Collection not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              {collectionLinks.length} link
              {collectionLinks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg
                        bg-surface-raised/50 border border-border-subtle
                        focus-within:border-accent-violet/30 transition-colors"
        >
          <Search size={14} className="text-text-ghost" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in collection..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-ghost outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-text-ghost hover:text-text-secondary transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

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
            <p className="text-sm text-text-secondary">
              {search
                ? "No matching links"
                : "This collection is empty"}
            </p>
            <p className="text-xs text-text-ghost mt-1">
              {search
                ? "Try adjusting your search"
                : "Add links from your Library using the card menu"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredLinks.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                mode="library"
                activeCollectionId={collectionId}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
