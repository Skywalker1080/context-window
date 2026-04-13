"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, AlertTriangle } from "lucide-react";
import { useLinks } from "@/contexts/LinksContext";
import { LinkCard } from "./LinkCard";

export function InboxQueue() {
  const { inboxLinks, inboxFull, loading } = useLinks();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-violet-soft">
            <Image 
              src="/queue.svg" 
              alt="Queue Logo" 
              width={18} 
              height={18}
              className="w-[18px] h-[18px] object-contain"
              priority
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Review Queue
            </h2>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
              Triage before it stacks up
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {inboxFull && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent-amber-soft text-accent-amber"
            >
              <AlertTriangle size={12} />
              <span className="text-[10px] font-semibold">CONTEXT WINDOW FULL</span>
            </motion.div>
          )}
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  i < inboxLinks.length
                    ? inboxFull
                      ? "bg-accent-amber shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                      : "bg-accent-violet shadow-[0_0_8px_rgba(171,85,61,0.3)]"
                    : "bg-border-subtle"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {inboxLinks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="p-4 rounded-2xl bg-surface-raised/50 mb-4">
              <Zap size={28} className="text-accent-violet" />
            </div>
            <p className="text-sm text-text-secondary font-medium">
              Inbox clear
            </p>
            <p className="text-xs text-text-ghost mt-1">
              Capture a link above to start
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {inboxLinks.map((link) => (
              <LinkCard key={link.id} link={link} mode="inbox" />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
