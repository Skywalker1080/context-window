"use client";

import { motion } from "framer-motion";
import { Sparkles, Plus, X } from "lucide-react";
import type { LinkItem } from "@/types";
import { useLinks } from "@/contexts/LinksContext";

interface EnrichmentSectionProps {
  link: LinkItem;
  compact?: boolean;
}

/**
 * Renders the AI enrichment state of a link:
 *   - pending/enriching → shimmer skeleton
 *   - done → summary + suggested-tags chips (accept + / dismiss ×)
 *   - failed → nothing (silent — the card is still fully usable)
 */
export function EnrichmentSection({ link, compact = false }: EnrichmentSectionProps) {
  const { updateLink } = useLinks();

  if (link.enrichmentStatus === "pending" || link.enrichmentStatus === "enriching") {
    return (
      <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2 pl-8"}>
        <div className="shimmer h-2.5 w-3/4 rounded" />
        <div className="shimmer h-2.5 w-1/2 rounded" />
        <div className="flex gap-1.5 pt-1">
          <div className="shimmer h-4 w-12 rounded-full" />
          <div className="shimmer h-4 w-16 rounded-full" />
          <div className="shimmer h-4 w-10 rounded-full" />
        </div>
      </div>
    );
  }

  if (link.enrichmentStatus !== "done") return null;

  const visibleSuggestions = link.suggestedTags.filter(
    (t) => !link.tags.includes(t)
  );
  if (!link.summary && visibleSuggestions.length === 0) return null;

  const acceptTag = (tag: string) => {
    void updateLink(link.id, {
      tags: [...link.tags, tag],
      suggestedTags: link.suggestedTags.filter((t) => t !== tag),
    });
  };

  const dismissTag = (tag: string) => {
    void updateLink(link.id, {
      suggestedTags: link.suggestedTags.filter((t) => t !== tag),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={compact ? "mt-2" : "mt-3 pl-8"}
    >
      {/* In compact mode the summary is rendered in the card's description slot
          (replaces metascraper description) — only render the framed panel in
          non-compact mode (e.g. detail views). */}
      {!compact && link.summary && (
        <div className="rounded-md border border-accent-violet-soft bg-accent-violet-soft/20 px-2.5 py-2">
          <div className="mb-1 flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-accent-violet">
            <Sparkles size={9} />
            AI Summary
          </div>
          <p className="text-[11px] leading-snug text-text-primary">
            {link.summary}
          </p>
        </div>
      )}
      {visibleSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[9px] font-mono uppercase tracking-wider text-text-ghost">
            Suggested:
          </span>
          {visibleSuggestions.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-accent-violet/40 bg-accent-violet-soft/20 px-1.5 py-0.5 text-[10px] text-accent-violet"
            >
              {tag}
              <button
                onClick={() => acceptTag(tag)}
                aria-label={`Accept tag ${tag}`}
                className="rounded-full p-0.5 hover:bg-accent-violet-soft hover:text-accent-violet"
              >
                <Plus size={9} />
              </button>
              <button
                onClick={() => dismissTag(tag)}
                aria-label={`Dismiss tag ${tag}`}
                className="rounded-full p-0.5 hover:bg-accent-rose-soft hover:text-accent-rose"
              >
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
