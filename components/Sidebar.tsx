"use client";

import { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  User,
  Download,
  Share,
  Plus,
  X,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useLinks } from "@/contexts/LinksContext";
import { usePWAInstall } from "@/hooks/usePWAInstall";

type View = "inbox" | "library" | "insights";

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { inboxLinks, insights } = useLinks();
  const { canInstall, isIOS, showIOSGuide, install, dismissIOSGuide } =
    usePWAInstall();

  const navItems: {
    id: View;
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
      <nav className="flex-1 space-y-1">
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
          {user?.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.photoURL}
              alt=""
              className="w-7 h-7 rounded-lg object-cover"
            />
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
