"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Global variable to capture the event exactly when it fires,
// even if the component hasn't mounted yet.
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    // Dispatch a custom event so active hooks can update
    window.dispatchEvent(new Event("installpromptready"));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isiOS);

    // Initial check for global prompt
    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    // Listen for custom event in case it fires after mount
    const updatePrompt = () => {
      setDeferredPrompt(globalDeferredPrompt);
    };
    window.addEventListener("installpromptready", updatePrompt);

    // Detect install success
    const onInstall = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
    };
    window.addEventListener("appinstalled", onInstall);

    return () => {
      window.removeEventListener("installpromptready", updatePrompt);
      window.removeEventListener("appinstalled", onInstall);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setIsInstalled(true);
        globalDeferredPrompt = null;
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback: If on desktop/android but no prompt caught, we can't trigger native install.
      // Often means they dismissed it previously or it's not supported natively here.
      alert("App can be installed from your browser's menu (Share or Install option).");
    }
  }, [deferredPrompt, isIOS]);

  const dismissIOSGuide = useCallback(() => {
    setShowIOSGuide(false);
  }, []);

  // Show button if not installed, AND (we caught the prompt, or it's iOS, or we just want to offer the fallback)
  const canInstall = !isInstalled && (!!deferredPrompt || isIOS || !isInstalled);

  return {
    canInstall,
    isInstalled,
    isIOS,
    showIOSGuide,
    install,
    dismissIOSGuide,
  };
}
