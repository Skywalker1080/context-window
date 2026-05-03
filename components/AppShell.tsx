"use client";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LinksProvider } from "@/contexts/LinksContext";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { AuthPage } from "@/components/AuthPage";
import { Dashboard } from "@/components/Dashboard";
import { Toaster } from "@/components/Toaster";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex relative overflow-hidden bg-void">
        {/* Skeleton Sidebar (Desktop) */}
        <aside className="hidden lg:flex w-56 flex-shrink-0 border-r border-border-subtle glass-strong fixed inset-y-0 left-0 z-40 flex-col py-6 px-3">
          <div className="flex items-center gap-3 px-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-surface-raised shimmer" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-surface-raised rounded shimmer w-3/4" />
              <div className="h-2 bg-surface-raised rounded shimmer w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-surface-raised rounded-xl shimmer w-full" />
            ))}
          </div>
          <div className="mt-auto pt-4 border-t border-border-subtle">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 rounded-lg bg-surface-raised shimmer flex-shrink-0" />
              <div className="h-3 bg-surface-raised rounded shimmer w-2/3" />
            </div>
          </div>
        </aside>

        {/* Mobile Header Skeleton */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-strong px-4 py-3 flex items-center justify-between">
          <div className="w-9 h-9 rounded-lg bg-surface-raised shimmer" />
          <div className="w-32 h-5 bg-surface-raised rounded shimmer" />
          <div className="w-9 h-9 rounded-lg bg-surface-raised shimmer" />
        </div>

        {/* Main Content Skeleton */}
        <main className="flex-1 lg:ml-56 relative z-10 min-w-0 w-full">
          <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-20 lg:pt-8 pb-16">
            {/* Capture Bar Skeleton */}
            <div className="mb-8">
              <div className="h-14 bg-surface-raised rounded-xl shimmer w-full" />
            </div>
            
            {/* Content Area Skeleton */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-surface-raised shimmer" />
                <div className="space-y-2">
                  <div className="h-4 bg-surface-raised rounded shimmer w-32" />
                  <div className="h-2 bg-surface-raised rounded shimmer w-48" />
                </div>
              </div>
              
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-surface-raised rounded-xl shimmer w-full" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <LinksProvider>
      <CollectionsProvider>
        <Dashboard />
      </CollectionsProvider>
    </LinksProvider>
  );
}

export default function AppShell() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
