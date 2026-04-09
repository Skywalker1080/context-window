"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Inbox, Library, BarChart3, LogOut, User, Layers } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLinks } from "@/contexts/LinksContext";

type View = "inbox" | "library" | "insights";

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { inboxLinks, insights } = useLinks();

  const navItems: {
    id: View;
    label: string;
    icon: ReactNode;
    badge?: number;
  }[] = [
    {
      id: "inbox",
      label: "Inbox",
      icon: <Inbox size={18} />,
      badge: inboxLinks.length || undefined,
    },
    {
      id: "library",
      label: "Library",
      icon: <Library size={18} />,
      badge: insights.libraryCount || undefined,
    },
    {
      id: "insights",
      label: "Insights",
      icon: <BarChart3 size={18} />,
    },
  ];

  return (
    <div className="h-full flex flex-col py-6 px-3">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="p-2 rounded-xl bg-gradient-to-br from-accent-violet to-accent-cyan">
          <Layers size={20} className="text-white" />
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
                  className="absolute inset-0 glass rounded-xl glow-violet"
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
                      item.id === "inbox" && item.badge >= 5
                        ? "bg-amber-500/20 text-amber-400"
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
          </div>
          <button
            onClick={signOut}
            className="p-1.5 rounded-lg text-text-ghost hover:text-rose-400
                       hover:bg-rose-500/10 transition-all duration-200"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
