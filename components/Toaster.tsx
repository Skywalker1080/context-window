"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudOff, Wifi, AlertTriangle, Check, Info } from "lucide-react";
import { subscribeToToasts, type Toast, type ToastKind } from "@/lib/toast";

const kindStyles: Record<
  ToastKind,
  { ring: string; iconColor: string; Icon: typeof AlertTriangle }
> = {
  warn: {
    ring: "border-accent-amber/30",
    iconColor: "text-accent-amber",
    Icon: CloudOff,
  },
  error: {
    ring: "border-accent-rose/40",
    iconColor: "text-accent-rose",
    Icon: AlertTriangle,
  },
  success: {
    ring: "border-accent-emerald/30",
    iconColor: "text-accent-emerald",
    Icon: Check,
  },
  info: {
    ring: "border-accent-cyan/30",
    iconColor: "text-accent-cyan",
    Icon: Info,
  },
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setToasts((prev) => [...prev, toast]);
      const dur = toast.duration ?? 4000;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, dur);
    });
  }, []);

  return (
    <>
      {/* Persistent offline banner */}
      <AnimatePresence>
        {!online && (
          <motion.div
            key="offline-banner"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
          >
            <div className="glass-strong border border-accent-amber/30 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg">
              <CloudOff size={14} className="text-accent-amber" />
              <span className="text-xs font-mono uppercase tracking-wider text-accent-amber">
                Offline · read-only
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none max-w-[calc(100vw-2rem)]">
        <AnimatePresence>
          {toasts.map((toast) => {
            const style = kindStyles[toast.kind];
            const Icon = style.Icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className={`pointer-events-auto glass-strong border ${style.ring} rounded-xl px-4 py-3
                            flex items-start gap-3 min-w-[260px] max-w-sm shadow-xl`}
              >
                <div className={`flex-shrink-0 mt-0.5 ${style.iconColor}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-text-primary leading-snug">
                    {toast.title}
                  </p>
                  {toast.body && (
                    <p className="mt-0.5 text-xs text-text-secondary leading-relaxed">
                      {toast.body}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Reconnect flash (single transient when coming back online) */}
      <ReconnectFlash online={online} />
    </>
  );
}

function ReconnectFlash({ online }: { online: boolean }) {
  const [show, setShow] = useState(false);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setHasBeenOffline(true);
      setShow(false);
      return;
    }
    if (online && hasBeenOffline) {
      setShow(true);
      const t = window.setTimeout(() => setShow(false), 2200);
      return () => window.clearTimeout(t);
    }
  }, [online, hasBeenOffline]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
        >
          <div className="glass-strong border border-accent-emerald/30 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg">
            <Wifi size={14} className="text-accent-emerald" />
            <span className="text-xs font-mono uppercase tracking-wider text-accent-emerald">
              Back online
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
