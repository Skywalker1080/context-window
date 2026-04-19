"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { CaptureBar } from "@/components/CaptureBar";
import { InboxQueue } from "@/components/InboxQueue";
import { LibraryView } from "@/components/LibraryView";
import { InsightsPanel } from "@/components/InsightsPanel";
import { CollectionView } from "@/components/CollectionView";
import type { View } from "@/types";

export function Dashboard() {
  const [activeView, setActiveView] = useState<View>("inbox");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleViewChange = (view: View, collectionId?: string) => {
    setActiveView(view);
    if (view === "collection" && collectionId) {
      setActiveCollectionId(collectionId);
    } else if (view !== "collection") {
      setActiveCollectionId(null);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case "inbox":
        return <InboxQueue />;
      case "library":
        return <LibraryView />;
      case "insights":
        return <InsightsPanel />;
      case "collection":
        return activeCollectionId ? (
          <CollectionView collectionId={activeCollectionId} />
        ) : (
          <LibraryView />
        );
      default:
        return <InboxQueue />;
    }
  };

  return (
    <div className="min-h-dvh flex relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-accent-violet/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-accent-cyan/4 rounded-full blur-[120px]" />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-56 flex-shrink-0 fixed inset-y-0 left-0 z-40 bg-void border-r border-border-subtle">
        <Sidebar
          activeView={activeView}
          activeCollectionId={activeCollectionId}
          onViewChange={handleViewChange}
        />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-strong px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary
                     hover:bg-surface-overlay transition-all"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="text-sm font-bold text-text-primary tracking-tight">
          Context Window
        </span>
        <div className="w-9" />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-void/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 w-56 z-50 bg-void border-r border-border-subtle"
            >
              <Sidebar
                activeView={activeView}
                activeCollectionId={activeCollectionId}
                onViewChange={(view, collectionId) => {
                  handleViewChange(view, collectionId);
                  setMobileMenuOpen(false);
                }}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 lg:ml-56 relative z-10 min-w-0 w-full">
        <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-20 lg:pt-8 pb-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <CaptureBar />
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView === "collection" ? `collection-${activeCollectionId}` : activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
