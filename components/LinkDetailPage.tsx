"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Tag,
  Sparkles,
  Clock,
  Copy,
  Check,
  Plus,
  X,
} from "lucide-react";
import { useLinks } from "@/contexts/LinksContext";
import { showToast } from "@/lib/toast";

interface LinkDetailPageProps {
  linkId: string;
  onBack: () => void;
}

export function LinkDetailPage({ linkId, onBack }: LinkDetailPageProps) {
  const { links, updateLink } = useLinks();
  const [copied, setCopied] = useState(false);

  // Always render the latest version of the link from context — so enrichment
  // updates that arrive via Realtime appear live while the page is open.
  const link = links.find((l) => l.id === linkId);

  // ESC goes back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onBack]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [linkId]);

  if (!link) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-text-muted">Link not found.</p>
        <button
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-accent-cyan hover:underline"
        >
          <ArrowLeft size={12} />
          Back
        </button>
      </div>
    );
  }

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

  const removeTag = (tag: string) => {
    void updateLink(link.id, {
      tags: link.tags.filter((t) => t !== tag),
    });
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      showToast({ kind: "success", title: "Link copied" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast({ kind: "error", title: "Couldn't copy link" });
    }
  };

  const visibleSuggestions = link.suggestedTags.filter(
    (t) => !link.tags.includes(t)
  );

  // Images (and future v2 documents) open full-page on this same route.
  if (link.kind === "image") {
    const variants = link.metadata?.variants as
      | { thumb?: string; display?: string }
      | undefined;
    return (
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mx-auto max-w-3xl px-4 lg:px-0 pb-24"
      >
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-primary"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-raised hover:border-border-default"
          >
            Open original
            <ExternalLink size={12} />
          </a>
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border border-border-subtle bg-black/40">
          <img
            src={variants?.display ?? link.url}
            srcSet={
              variants?.thumb && variants?.display
                ? `${variants.thumb} 400w, ${variants.display} 1600w`
                : undefined
            }
            alt={link.title || "Saved image"}
            className="block w-full h-auto max-h-[70vh] object-contain"
          />
        </div>

        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-ghost">
            <span>Image</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {new Date(link.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {link.width && link.height && (
              <>
                <span>·</span>
                <span>
                  {link.width} × {link.height}
                </span>
              </>
            )}
            {link.category && (
              <>
                <span>·</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-text-muted normal-case">
                  {link.category}
                </span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-text-primary">
            {link.title || "Untitled image"}
          </h1>
        </header>

        {(link.tags.length > 0 || visibleSuggestions.length > 0) && (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-ghost">
              <Tag size={11} />
              Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {link.tags.map((t) => (
                <span
                  key={t}
                  className="group inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs text-text-primary"
                >
                  #{t}
                  <button
                    onClick={() => removeTag(t)}
                    aria-label={`Remove tag ${t}`}
                    className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent-rose"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}

        {link.note && (
          <section className="mb-8 rounded-xl border border-border-subtle bg-surface p-5">
            <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-text-ghost">
              Your note
            </div>
            <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
              {link.note}
            </p>
          </section>
        )}
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto max-w-2xl px-4 lg:px-0 pb-24"
    >
      {/* Back bar */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-raised hover:border-border-default"
        >
          Open original
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Hero thumbnail — full width of the column */}
      {link.thumbnail && (
        <div className="mb-8 -mx-4 lg:mx-0 overflow-hidden lg:rounded-2xl border-y lg:border border-border-subtle bg-surface">
          <img
            src={link.thumbnail}
            alt=""
            className="block w-full h-auto max-h-96 object-cover"
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Document header */}
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-ghost">
          <img
            src={link.favicon}
            alt=""
            className="h-4 w-4 rounded-sm bg-white/85 p-0.5"
            onError={(e) => {
              e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${getDomain(
                link.url
              )}&sz=64`;
            }}
          />
          <span>{getDomain(link.url)}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {new Date(link.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {link.category && (
            <>
              <span>·</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-text-muted normal-case">
                {link.category}
              </span>
            </>
          )}
          {link.enrichmentStatus === "done" && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 rounded-full bg-accent-violet-soft/40 px-2 py-0.5 text-accent-violet normal-case">
                <Sparkles size={9} />
                AI enriched
              </span>
            </>
          )}
        </div>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-text-primary">
          {link.title || link.url}
        </h1>

        {/* URL row with copy */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate font-mono text-xs text-accent-cyan hover:underline"
          >
            {link.url}
          </a>
          <button
            onClick={copyUrl}
            aria-label="Copy URL"
            className="shrink-0 rounded-md p-1.5 text-text-ghost transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </header>

      {/* AI Summary — the lead paragraph */}
      {link.enrichmentStatus === "done" && link.summary && (
        <section className="mb-8 rounded-xl border border-accent-violet-soft bg-accent-violet-soft/15 p-5">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-accent-violet">
            <Sparkles size={11} />
            AI Summary
          </div>
          <p className="text-base leading-relaxed text-text-primary">
            {link.summary}
          </p>
        </section>
      )}

      {/* Failure state — be honest, not silent */}
      {link.enrichmentStatus === "failed" && (
        <section className="mb-8 rounded-xl border border-dashed border-border-subtle bg-surface/30 p-5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-ghost">
            <Sparkles size={11} />
            AI Summary
          </div>
          <p className="text-sm italic text-text-muted">
            We couldn&apos;t generate a summary for this page — the site may be
            blocking our scraper, or the content is mostly JavaScript-rendered.
          </p>
        </section>
      )}

      {/* Description — only if distinct from summary */}
      {link.description && link.description !== link.summary && (
        <section className="mb-8">
          <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-text-ghost">
            Description
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            {link.description}
          </p>
        </section>
      )}

      {/* Tags */}
      {(link.tags.length > 0 || visibleSuggestions.length > 0) && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-ghost">
            <Tag size={11} />
            Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {link.tags.map((t) => (
              <span
                key={t}
                className="group inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs text-text-primary"
              >
                #{t}
                <button
                  onClick={() => removeTag(t)}
                  aria-label={`Remove tag ${t}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent-rose"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {visibleSuggestions.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-accent-violet/40 bg-accent-violet-soft/20 px-2.5 py-1 text-xs text-accent-violet"
              >
                {t}
                <button
                  onClick={() => acceptTag(t)}
                  aria-label={`Accept tag ${t}`}
                  className="rounded-full p-0.5 hover:bg-accent-violet-soft"
                >
                  <Plus size={9} />
                </button>
                <button
                  onClick={() => dismissTag(t)}
                  aria-label={`Dismiss tag ${t}`}
                  className="rounded-full p-0.5 hover:bg-accent-rose-soft hover:text-accent-rose"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Note */}
      {link.note && (
        <section className="mb-8 rounded-xl border border-border-subtle bg-surface p-5">
          <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-text-ghost">
            Your note
          </div>
          <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
            {link.note}
          </p>
        </section>
      )}

      {/* Coming soon panel */}
      <section className="mt-12 rounded-xl border border-dashed border-border-default bg-surface/40 p-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-text-primary">
          <Sparkles size={14} className="text-accent-violet" />
          In-app preview — coming soon
        </div>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-text-muted">
          We&apos;re building an inline reader so you can read the full page
          contents here without leaving Context Window.
        </p>
      </section>
    </motion.article>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}
