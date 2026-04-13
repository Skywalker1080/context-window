"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Trash2,
  BookmarkCheck,
  Tag,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
  Check,
} from "lucide-react";
import type { LinkItem } from "@/types";
import { useLinks, DEFAULT_CATEGORIES } from "@/contexts/LinksContext";

interface LinkCardProps {
  link: LinkItem;
  mode: "inbox" | "library";
}

export function LinkCard({ link, mode }: LinkCardProps) {
  const { triageLink, updateLink, deleteLink } = useLinks();
  const [expanded, setExpanded] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(link.category);
  const [localTags, setLocalTags] = useState<string[]>(link.tags);
  const [localNote, setLocalNote] = useState(link.note || "");

  const timeAgo = getTimeAgo(link.createdAt);

  const handleTriage = async (status: "library" | "deleted") => {
    if (status === "deleted") {
      await deleteLink(link.id);
    } else {
      await triageLink(link.id, status, selectedCategory, localTags);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (tag && !localTags.includes(tag)) {
      const newTags = [...localTags, tag];
      setLocalTags(newTags);
      if (mode === "library") {
        updateLink(link.id, { tags: newTags });
      }
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const newTags = localTags.filter((t) => t !== tag);
    setLocalTags(newTags);
    if (mode === "library") {
      updateLink(link.id, { tags: newTags });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.3 } }}
      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      className="group relative glass rounded-xl overflow-hidden
                 transition-all duration-300"
    >
      <div className="pl-5 pr-4 py-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={link.favicon}
              alt=""
              className="w-5 h-5 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=64`;
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link flex items-center gap-1.5 text-sm font-medium
                         text-text-primary hover:text-accent-violet transition-colors"
            >
              <span className="truncate min-w-0">{link.title || link.url}</span>
              <ExternalLink
                size={12}
                className="flex-shrink-0 opacity-0 group-hover/link:opacity-100
                           transition-opacity duration-200"
              />
            </a>
            <p className="text-xs text-text-muted mt-0.5 truncate font-mono">
              {new URL(link.url).hostname.replace("www.", "")}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-text-ghost font-mono flex items-center gap-1">
              <Clock size={10} />
              {timeAgo}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md text-text-ghost hover:text-text-secondary
                         hover:bg-surface-overlay transition-all duration-200"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {link.description && (
          <p className="mt-2 text-xs text-text-secondary line-clamp-2 pl-8">
            {link.description}
          </p>
        )}

        {link.note && !expanded && (
          <div className="mt-2 pl-8 flex items-start gap-1.5">
            <MessageSquare
              size={12}
              className="text-accent-violet mt-0.5 flex-shrink-0"
            />
            <p className="text-xs text-accent-violet/80">{link.note}</p>
          </div>
        )}

        {localTags.length > 0 && (
          <div className="mt-2 pl-8 flex flex-wrap gap-1.5">
            {localTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                           bg-accent-violet-soft text-accent-violet text-[10px] font-medium font-mono"
              >
                {tag}
                {(expanded || mode === "inbox") && (
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-accent-rose transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Expanded — category & tag editing */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mt-3 pl-8 space-y-4"
          >
            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                <MessageSquare size={10} />
                Personal Note
              </label>
              <textarea
                value={localNote}
                onChange={(e) => setLocalNote(e.target.value)}
                onBlur={() => {
                  if (localNote !== link.note) {
                    updateLink(link.id, { note: localNote });
                  }
                }}
                placeholder="Why did you save this?"
                className="w-full bg-surface-raised/50 border border-border-subtle rounded-lg
                           px-3 py-2 text-xs text-text-secondary placeholder-text-ghost
                           outline-none resize-none focus:border-accent-violet/30 transition-colors font-sans"
                rows={2}
              />
            </div>

            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-1.5 block">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => {
                      setSelectedCategory(cat.name);
                      if (mode === "library") {
                        updateLink(link.id, { category: cat.name });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200
                      ${
                        selectedCategory === cat.name
                          ? "bg-accent-violet/20 text-accent-violet border border-accent-violet/30"
                          : "bg-surface-overlay text-text-muted hover:text-text-secondary border border-transparent"
                      }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                <Tag size={10} />
                Tags
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="#add-tag"
                  className="flex-1 min-w-0 w-full bg-surface-raised/50 border border-border-subtle rounded-lg
                             px-3 py-1.5 text-xs text-text-secondary placeholder-text-ghost
                             outline-none focus:border-accent-violet/30 transition-colors font-mono"
                />
                <button
                  onClick={addTag}
                  disabled={!tagInput.trim()}
                  className="p-1.5 rounded-lg bg-accent-violet/20 text-accent-violet
                             hover:bg-accent-violet/30 transition-all disabled:opacity-30"
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="mt-3 pl-8 flex flex-wrap items-center gap-2">
          {mode === "inbox" ? (
            <>
              <button
                onClick={() => handleTriage("library")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-accent-emerald-soft text-accent-emerald hover:bg-accent-emerald/25
                           transition-all duration-200"
              >
                <BookmarkCheck size={14} />
                Keep
              </button>
              <button
                onClick={() => handleTriage("deleted")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-surface-overlay text-text-muted hover:text-accent-rose hover:bg-accent-rose-soft
                           transition-all duration-200"
              >
                <Trash2 size={14} />
                Trash
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleTriage("deleted")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-surface-overlay text-text-muted hover:text-accent-rose
                           hover:bg-accent-rose-soft transition-all duration-200"
              >
                <Trash2 size={14} />
                Trash
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
