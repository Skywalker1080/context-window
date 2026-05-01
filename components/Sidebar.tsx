"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  User,
  Download,
  Share,
  Plus,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  ArrowBigDown,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useLinks } from "@/contexts/LinksContext";
import { useCollections } from "@/contexts/CollectionsContext";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import type { View } from "@/types";

interface SidebarProps {
  activeView: View;
  activeCollectionId: string | null;
  onViewChange: (view: View, collectionId?: string) => void;
}

export function Sidebar({ activeView, activeCollectionId, onViewChange }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { inboxLinks, insights, links } = useLinks();
  const { collections, createCollection, renameCollection, deleteCollection } =
    useCollections();
  const { canInstall, showIOSGuide, install, dismissIOSGuide } =
    usePWAInstall();

  const isGoogleUser = !!user?.providerData?.some((p) => p.providerId === "google.com");
  const userInitial = (
    (user?.displayName?.trim()?.[0] ?? user?.email?.trim()?.[0] ?? "U")
  ).toUpperCase();

  // Collection creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const createInputRef = useRef<HTMLInputElement>(null);

  // Collection rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Changelog state
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("changelog_v1.1_dismissed");
    if (!dismissed) {
      setShowChangelog(true);
    }
  }, []);

  const dismissChangelog = () => {
    localStorage.setItem("changelog_v1.1_dismissed", "true");
    setShowChangelog(false);
  };

  // Auto-focus create input
  useEffect(() => {
    if (isCreating) createInputRef.current?.focus();
  }, [isCreating]);

  // Auto-focus rename input
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setIsCreating(false);
      setNewName("");
      return;
    }
    const id = await createCollection(name);
    setIsCreating(false);
    setNewName("");
    onViewChange("collection", id);
  };

  const handleRename = async (id: string) => {
    const name = renameValue.trim();
    if (name) await renameCollection(id, name);
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDelete = async (id: string) => {
    setMenuOpenId(null);
    await deleteCollection(id);
    // If we were viewing this collection, go back to library
    if (activeView === "collection" && activeCollectionId === id) {
      onViewChange("library");
    }
  };

  const getCollectionLinkCount = (collectionId: string) => {
    return links.filter(
      (l) => l.status === "library" && l.collectionIds.includes(collectionId)
    ).length;
  };

  type NavView = "inbox" | "library" | "insights";
  const navItems: {
    id: NavView;
    label: string;
    icon: ReactNode;
    badge?: number;
  }[] = [
    {
      id: "inbox",
      label: "Queue",
      icon: <Image src="/queue.svg" alt="" width={20} height={20} className="object-cover rounded-md" />,
      badge: inboxLinks.length || undefined,
    },
    {
      id: "library",
      label: "Library",
      icon: <Image src="/library.svg" alt="" width={20} height={20} className="object-cover rounded-md" />,
      badge: insights.libraryCount || undefined,
    },
    {
      id: "insights",
      label: "Insights",
      icon: <Image src="/insights.svg" alt="" width={20} height={20} className="object-cover rounded-md" />,
    },
  ];

  return (
    <div className="h-full flex flex-col py-6 px-3">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="p-2 rounded-xl bg-accent-violet flex-shrink-0">
          <Image 
            src="/context_window.svg" 
            alt="Context Window Logo" 
            width={24} 
            height={24}
            priority
          />
        </div>
        <div>
          <h1 className="text-sm font-bold text-text-primary tracking-tight">
            Context Window
          </h1>
          <p className="text-[9px] text-text-ghost font-mono uppercase tracking-[0.2em]">
            PKM Tool
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                         text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface-raised/50"
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 glass rounded-xl"
                  transition={{
                    type: "spring",
                    damping: 25,
                    stiffness: 300,
                  }}
                />
              )}
              <span className="relative z-10">{item.icon}</span>
              <span className="relative z-10">{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={`relative z-10 ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold
                    ${
                      item.id === "inbox" && item.badge >= 9
                        ? "bg-accent-amber-soft text-accent-amber"
                        : "bg-accent-violet-soft text-accent-violet"
                    }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="h-8 flex-shrink-0" />

      {/* Collections Section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-[12px] text-text-ghost font-inter tracking-wider font-medium">
            Collections
          </span>
          <button
            onClick={() => {
              setIsCreating(true);
              setNewName("");
            }}
            className="p-1 rounded-md text-text-ghost hover:text-accent-violet
                       hover:bg-accent-violet-soft transition-all duration-200"
            title="New collection"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5">
          {/* Create input */}
          <AnimatePresence>
            {isCreating && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <div className="w-1 h-1 rounded-full bg-text-secondary flex-shrink-0" />
                  <input
                    ref={createInputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") {
                        setIsCreating(false);
                        setNewName("");
                      }
                    }}
                    onBlur={handleCreate}
                    placeholder="Collection name…"
                    className="flex-1 min-w-0 bg-transparent text-xs text-text-primary
                               placeholder-text-ghost outline-none border-b border-accent-violet/30
                               py-1 transition-colors"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collection items */}
          {collections.map((col) => {
            const isActive =
              activeView === "collection" && activeCollectionId === col.id;
            const count = getCollectionLinkCount(col.id);

            return (
              <div key={col.id} className="relative group/col">
                {renamingId === col.id ? (
                  /* Rename inline input */
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <div className="w-1 h-1 rounded-full bg-text-secondary flex-shrink-0" />
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(col.id);
                        if (e.key === "Escape") {
                          setRenamingId(null);
                          setRenameValue("");
                        }
                      }}
                      onBlur={() => handleRename(col.id)}
                      className="flex-1 min-w-0 bg-transparent text-xs text-text-primary
                                 outline-none border-b border-accent-violet/30 py-0.5 transition-colors"
                    />
                    <button
                      onClick={() => handleRename(col.id)}
                      className="p-0.5 rounded text-accent-violet"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  /* Normal collection button */
                  <button
                    onClick={() => onViewChange("collection", col.id)}
                    className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                               text-xs font-medium transition-all duration-200
                      ${
                      isActive
                        ? "text-text-primary bg-accent-violet/10"
                        : "text-text-muted hover:text-text-secondary hover:bg-surface-raised/50"
                    }`}
                  >
                    <div
                      className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors
                        ${isActive ? "bg-text-secondary" : "bg-text-ghost"}
                      `}
                    />
                    <span className="truncate flex-1 text-left">{col.name}</span>
                    {count > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold
                                       bg-accent-violet-soft text-accent-violet">
                        {count}
                      </span>
                    )}

                    {/* More menu trigger */}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === col.id ? null : col.id);
                      }}
                      className="p-0.5 rounded text-text-ghost opacity-0 group-hover/col:opacity-100
                                 hover:text-text-secondary hover:bg-surface-overlay transition-all duration-200"
                    >
                      <MoreHorizontal size={14} />
                    </span>
                  </button>
                )}

                {/* Context menu */}
                <AnimatePresence>
                  {menuOpenId === col.id && (
                    <motion.div
                      ref={menuRef}
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-2 top-full mt-1 z-50 w-36 py-1
                                 glass-strong rounded-lg shadow-lg border border-border-subtle"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          setRenameValue(col.name);
                          setRenamingId(col.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary
                                   hover:text-text-primary hover:bg-surface-raised/50 transition-colors"
                      >
                        <Pencil size={12} />
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(col.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary
                                   hover:text-accent-rose hover:bg-accent-rose-soft transition-colors"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Empty state */}
          {collections.length === 0 && !isCreating && (
            <p className="px-3 py-3 text-[10px] text-text-ghost text-center leading-relaxed">
              Organize links into collections
            </p>
          )}
        </div>
      </div>

      {/* Changelog */}
      <AnimatePresence>
        {showChangelog && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="px-3 overflow-hidden"
          >
            <div className="relative p-3 rounded-xl bg-surface-raised/40 border border-border-subtle group hover:border-accent-violet/30 transition-colors cursor-pointer"
                 onClick={() => onViewChange("changelog")}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissChangelog();
                }}
                className="absolute top-2 right-2 p-1 rounded-md text-text-ghost hover:text-text-primary hover:bg-surface-overlay transition-colors z-10"
                title="Dismiss"
              >
                <X size={12} />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <ArrowBigDown size={14} className="text-accent-violet" />
                <span className="text-xs font-bold text-text-primary tracking-tight">What's new</span>
              </div>
              <p className="text-[10px] text-text-secondary leading-tight pr-6">
                Version v1.1.0 is here. Click to view the latest updates!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install App CTA */}
      <AnimatePresence>
        {canInstall && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-3 mb-3"
          >
            <button
              onClick={install}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                         bg-accent-violet/10 border border-accent-violet/20
                         text-text-primary text-sm font-medium
                         hover:bg-accent-violet/20 hover:border-accent-violet/40
                         transition-all duration-300 group"
            >
              <div className="p-1.5 rounded-lg bg-accent-violet/20 group-hover:bg-accent-violet/30 transition-colors">
                <Download size={14} className="text-accent-violet" />
              </div>
              <span>Install App</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Install Guide Overlay */}
      <AnimatePresence>
        {showIOSGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end"
          >
            <div
              className="absolute inset-0 bg-void/70 backdrop-blur-sm"
              onClick={dismissIOSGuide}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full glass-strong rounded-t-2xl border-t border-border-subtle p-5"
            >
              <button
                onClick={dismissIOSGuide}
                className="absolute top-3 right-3 p-1 rounded-lg text-text-ghost hover:text-text-primary
                           hover:bg-surface-overlay transition-colors"
              >
                <X size={16} />
              </button>

              <h3 className="text-sm font-bold text-text-primary mb-4">
                Install on iOS
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-violet-soft flex items-center justify-center">
                    <span className="text-[10px] font-bold text-accent-violet">
                      1
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Tap the{" "}
                    <Share
                      size={12}
                      className="inline text-accent-violet align-text-bottom"
                    />{" "}
                    <strong>Share</strong> button in Safari&apos;s toolbar
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-violet-soft flex items-center justify-center">
                    <span className="text-[10px] font-bold text-accent-violet">
                      2
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Scroll down and tap{" "}
                    <Plus
                      size={12}
                      className="inline text-accent-violet align-text-bottom"
                    />{" "}
                    <strong>Add to Home Screen</strong>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-violet-soft flex items-center justify-center">
                    <span className="text-[10px] font-bold text-accent-violet">
                      3
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Tap <strong>Add</strong> to install
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User */}
      <div className="mt-auto pt-4 border-t border-border-subtle">
        <div className="flex items-center gap-3 px-3 py-2">
          {isGoogleUser && user?.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.photoURL}
              alt=""
              className="w-7 h-7 rounded-lg object-cover"
            />
          ) : !isGoogleUser ? (
            <div className="w-7 h-7 rounded-lg bg-accent-violet-soft flex items-center justify-center">
              <span className="text-[11px] font-bold text-accent-violet">
                {userInitial}
              </span>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-accent-violet-soft flex items-center justify-center">
              <User size={14} className="text-accent-violet" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-secondary truncate">
              {user?.displayName || user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-[10px] text-text-ghost font-medium">
              Beta Account
            </p>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 rounded-lg text-text-ghost hover:text-accent-rose
                       hover:bg-accent-rose-soft transition-all duration-200"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
