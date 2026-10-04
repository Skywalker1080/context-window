"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  FolderOpen,
  Image as ImageIcon,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { LinkItem } from "@/types";
import { useLinks } from "@/contexts/LinksContext";
import { useCollections } from "@/contexts/CollectionsContext";
import { showToast } from "@/lib/toast";

interface ImageCardProps {
  link: LinkItem;
  activeCollectionId?: string;
  stacked?: boolean;
  onOpenDetail?: (link: LinkItem) => void;
  /** Local blob URL for optimistic pending uploads (originating tab only). */
  previewUrl?: string;
}

function aspectOf(link: LinkItem): { square: boolean; ratio?: string } {
  if (link.width && link.height && link.width > 0 && link.height > 0) {
    const r = link.width / link.height;
    if (r >= 0.9 && r <= 1.1) return { square: true };
    return { square: false, ratio: `${link.width} / ${link.height}` };
  }
  return { square: true };
}

export function ImageCard({ link, activeCollectionId, stacked = false, onOpenDetail, previewUrl }: ImageCardProps) {
  const { updateLink } = useLinks();
  const { collections, addLinkToCollection, removeLinkFromCollection } = useCollections();
  const [menuOpen, setMenuOpen] = useState(false);
  const aspect = aspectOf(link);

  const variants = link.metadata?.variants as
    | { thumb?: string; display?: string }
    | undefined;
  const src = previewUrl ?? variants?.display ?? link.url;
  const srcSet =
    !previewUrl && variants?.thumb && variants?.display
      ? `${variants.thumb} 400w, ${variants.display} 1600w`
      : undefined;

  const toggleBoard = async (collectionId: string) =>
    link.collectionIds.includes(collectionId)
      ? removeLinkFromCollection(link.id, collectionId)
      : addLinkToCollection(link.id, collectionId);

  const openDetail = () => {
    if (onOpenDetail) onOpenDetail(link);
  };

  const trash = async () => {
    setMenuOpen(false);
    try {
      // Soft-delete: row stays 7 days for the nightly S3 sweep (undo window).
      await updateLink(link.id, { status: "deleted" });
      showToast({ kind: "success", title: "Image moved to trash" });
    } catch {
      showToast({ kind: "error", title: "Couldn't trash image" });
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={`group relative w-full overflow-visible rounded-2xl border border-white/10 bg-[#20201f] shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(0,0,0,0.34)] ${stacked ? "board-card" : ""}`}
    >
      <div
        onClick={openDetail}
        onDoubleClick={openDetail}
        className={`relative overflow-hidden rounded-t-2xl bg-black/40 ${aspect.square ? "aspect-square" : ""} ${onOpenDetail ? "cursor-pointer" : ""}`}
        style={aspect.square ? undefined : { aspectRatio: aspect.ratio }}
      >
        {src ? (
          <img
            src={src}
            srcSet={srcSet}
            sizes="(max-width: 768px) 50vw, 33vw"
            alt={link.title || "Saved image"}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-ghost">
            <ImageIcon size={24} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        <span
          title={link.width && link.height ? `${link.width} × ${link.height}` : "Image"}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/85 backdrop-blur-sm"
        >
          <ImageIcon size={13} />
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <button
            onClick={openDetail}
            className="min-w-0 flex-1 text-left text-[15px] font-semibold leading-5 text-text-primary transition-colors hover:text-accent-violet cursor-pointer"
          >
            <span className="line-clamp-2">{link.title || "Untitled image"}</span>
          </button>
        </div>
        {link.note && (
          <p className="mt-2 text-xs leading-5 line-clamp-2 text-text-muted">{link.note}</p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/8 pt-3 text-[10px] font-mono text-text-ghost">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-1">
              <Clock size={11} /> {getTimeAgo(link.createdAt)}
            </span>
            {link.tags.length > 0 && (
              <span className="truncate text-text-muted">#{link.tags.join(" #")}</span>
            )}
          </span>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Image actions"
              className="rounded-md p-1 text-text-ghost transition-colors hover:bg-white/8 hover:text-text-primary"
            >
              <MoreHorizontal size={16} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  className="absolute bottom-8 right-0 z-20 w-48 overflow-hidden rounded-xl border border-border-subtle bg-[#2a2927] py-1 shadow-xl"
                >
                  {activeCollectionId && (
                    <button
                      onClick={() => void removeLinkFromCollection(link.id, activeCollectionId)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary hover:bg-white/5 hover:text-text-primary"
                    >
                      <X size={13} /> Remove from board
                    </button>
                  )}
                  {collections.length > 0 && (
                    <div className="border-t border-white/8 py-1">
                      <p className="px-3 py-1 text-[9px] font-mono uppercase tracking-wider text-text-ghost">
                        Boards
                      </p>
                      {collections.map((board) => (
                        <button
                          key={board.id}
                          onClick={() => void toggleBoard(board.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-white/5 hover:text-text-primary"
                        >
                          <FolderOpen size={13} />
                          <span className="truncate">
                            {link.collectionIds.includes(board.id) ? "✓ " : ""}
                            {board.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => void trash()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary hover:bg-accent-rose-soft hover:text-accent-rose"
                  >
                    <Trash2 size={13} /> Trash image
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function getTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
}
