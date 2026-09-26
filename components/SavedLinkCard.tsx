"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ExternalLink, FileText, FolderOpen, Globe, Layers, Link, MoreHorizontal, Trash2, Wrench, X } from "lucide-react";
import type { LinkItem } from "@/types";
import { useLinks } from "@/contexts/LinksContext";
import { useCollections } from "@/contexts/CollectionsContext";
import { EnrichmentSection } from "./EnrichmentSection";

interface SavedLinkCardProps { link: LinkItem; activeCollectionId?: string; stacked?: boolean; onOpenDetail?: (link: LinkItem) => void }

const coverStyles = ["from-[#d88a55] via-[#5b453d] to-[#262321]", "from-[#6b7798] via-[#3b4654] to-[#1e2425]", "from-[#6f8664] via-[#3e5142] to-[#1f2925]", "from-[#9c7657] via-[#5c4941] to-[#292421]"];

export function SavedLinkCard({ link, activeCollectionId, stacked = false, onOpenDetail }: SavedLinkCardProps) {
  const { deleteLink } = useLinks();
  const { collections, addLinkToCollection, removeLinkFromCollection } = useCollections();
  const [menuOpen, setMenuOpen] = useState(false);
  const domain = getDomain(link.url);
  const cover = coverStyles[hash(domain) % coverStyles.length];
  const toggleBoard = async (collectionId: string) => link.collectionIds.includes(collectionId)
    ? removeLinkFromCollection(link.id, collectionId)
    : addLinkToCollection(link.id, collectionId);

  const openDetail = () => { if (onOpenDetail) onOpenDetail(link); };

  return <motion.article layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.28, ease: "easeOut" }} className={`group relative w-full overflow-visible rounded-2xl border border-white/10 bg-[#20201f] shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(0,0,0,0.34)] ${stacked ? "board-card" : ""}`}>
    <div onClick={openDetail} className={`relative min-h-28 overflow-hidden rounded-t-2xl bg-gradient-to-br ${cover} ${onOpenDetail ? "cursor-pointer" : ""}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,.28),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(255,255,255,.13),transparent_18%)]" />
      {link.thumbnail && <img src={link.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="block h-auto max-h-80 w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
      <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-medium text-white/90">
        <img src={link.favicon} alt="" className="h-5 w-5 rounded-md bg-white/85 p-0.5" onError={(event) => { event.currentTarget.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`; }} />
        <span className="truncate">{domain}</span>
      </div>
      <span title={link.category || "Saved"} className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/85 backdrop-blur-sm"><CategoryGlyph category={link.category} /></span>
    </div>
    <div className="p-4">
      <div className="flex items-start gap-2"><a href={link.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (onOpenDetail && !e.metaKey && !e.ctrlKey) { e.preventDefault(); onOpenDetail(link); } }} className="min-w-0 flex-1 text-left text-[15px] font-semibold leading-5 text-text-primary transition-colors hover:text-accent-violet cursor-pointer"><span className="line-clamp-2">{link.title || link.url}</span></a><a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${link.title || domain}`} className="mt-0.5 text-text-ghost transition-colors hover:text-text-primary"><ExternalLink size={15} /></a></div>
      {(() => {
        const displayText =
          link.enrichmentStatus === "done" && link.summary ? link.summary : link.description;
        const isAiSummary = link.enrichmentStatus === "done" && !!link.summary;
        return displayText ? (
          <p
            onClick={openDetail}
            className={`mt-2 text-xs leading-5 line-clamp-2 ${isAiSummary ? "text-text-secondary" : "text-text-muted"} ${onOpenDetail ? "cursor-pointer" : ""}`}
          >
            {displayText}
          </p>
        ) : null;
      })()}
      <EnrichmentSection link={link} compact />
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/8 pt-3 text-[10px] font-mono text-text-ghost"><span className="flex min-w-0 items-center gap-1.5"><span className="flex shrink-0 items-center gap-1"><Clock size={11} /> {getTimeAgo(link.createdAt)}</span>{link.tags.length > 0 && <span className="truncate text-text-muted">#{link.tags.join(" #")}</span>}</span><div className="relative"><button onClick={() => setMenuOpen((value) => !value)} aria-label="Link actions" className="rounded-md p-1 text-text-ghost transition-colors hover:bg-white/8 hover:text-text-primary"><MoreHorizontal size={16} /></button><AnimatePresence>{menuOpen && <motion.div initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }} className="absolute bottom-8 right-0 z-20 w-48 overflow-hidden rounded-xl border border-border-subtle bg-[#2a2927] py-1 shadow-xl">
        {activeCollectionId && <button onClick={() => void removeLinkFromCollection(link.id, activeCollectionId)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary hover:bg-white/5 hover:text-text-primary"><X size={13} /> Remove from board</button>}
        {collections.length > 0 && <div className="border-t border-white/8 py-1"><p className="px-3 py-1 text-[9px] font-mono uppercase tracking-wider text-text-ghost">Boards</p>{collections.map((board) => <button key={board.id} onClick={() => void toggleBoard(board.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-white/5 hover:text-text-primary"><FolderOpen size={13} /><span className="truncate">{link.collectionIds.includes(board.id) ? "✓ " : ""}{board.name}</span></button>)}</div>}
        <button onClick={() => void deleteLink(link.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary hover:bg-accent-rose-soft hover:text-accent-rose"><Trash2 size={13} /> Trash link</button>
      </motion.div>}</AnimatePresence></div></div>
    </div>
  </motion.article>;
}

function CategoryGlyph({ category }: { category: string }) {
  const key = category.trim().toLowerCase();
  if (key === "github") {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>;
  }
  if (key === "twitter (x)" || key === "twitter" || key === "x") {
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>;
  }
  if (key === "youtube") {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>;
  }
  if (key === "reddit") {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="15" rx="6.8" ry="5" /><path d="M12 10.2 15.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="15.9" cy="4.5" r="1.4" /><circle cx="9.7" cy="14.2" r="1" fill="black" fillOpacity="0.65" /><circle cx="14.3" cy="14.2" r="1" fill="black" fillOpacity="0.65" /><path d="M9.3 17.3c.9.8 1.8 1.1 2.7 1.1s1.8-.3 2.7-1.1" stroke="black" strokeOpacity="0.65" strokeWidth="1.2" strokeLinecap="round" fill="none" /></svg>;
  }
  if (key === "linkedin") {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" /></svg>;
  }
  if (key === "website") return <Globe size={14} />;
  if (key === "documentation") return <FileText size={14} />;
  if (key === "tool") return <Wrench size={14} />;
  if (key === "substack") return <Layers size={14} />;
  return <Link size={14} />;
}

function getDomain(url: string) { try { return new URL(url).hostname.replace("www.", ""); } catch { return url; } }
function hash(value: string) { return [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0) >>> 0; }
function getTimeAgo(timestamp: number) { const seconds = Math.floor((Date.now() - timestamp) / 1000); if (seconds < 60) return "just now"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`; }
