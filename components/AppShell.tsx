"use client";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LinksProvider } from "@/contexts/LinksContext";
import { AuthPage } from "@/components/AuthPage";
import { Dashboard } from "@/components/Dashboard";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-accent-violet/30 border-t-accent-violet rounded-full animate-spin" />
          </div>
          <p className="text-xs text-text-ghost font-mono animate-pulse">
            Loading context...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <LinksProvider>
      <Dashboard />
    </LinksProvider>
  );
}

export default function AppShell() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
