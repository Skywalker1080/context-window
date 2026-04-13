"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  Zap,
  AlertTriangle,
  MessageSquare,
  Send,
  X,
} from "lucide-react";
import { useLinks } from "@/contexts/LinksContext";

export function CaptureBar() {
  const { addLink, inboxFull, inboxLinks } = useLinks();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);



  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!url.trim()) return;
      setError("");

      try {
        new URL(url.startsWith("http") ? url : `https://${url}`);
      } catch {
        setError("Please enter a valid URL");
        return;
      }

      const finalUrl = url.startsWith("http") ? url : `https://${url}`;

      try {
        setIsSubmitting(true);
        await addLink(finalUrl, note, []);
        setUrl("");
        setNote("");
        setShowNote(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to add link"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [url, note, addLink]
  );

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`
            relative flex items-center gap-3 rounded-xl px-4 py-3
            glass-strong transition-all duration-300
            ${inboxFull ? "border-accent-amber/30" : "border-transparent"}
            ${success ? "border-accent-emerald/50" : ""}
          `}
        >
          <div className="flex-shrink-0">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  className="text-accent-emerald"
                >
                  <Zap size={18} />
                </motion.div>
              ) : (
                <motion.div
                  key="default"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="text-text-muted"
                >
                  <Link2 size={18} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <input
            ref={inputRef}
            id="capture-input"
            type="text"
            value={url}
            onChange={(e) => {
              const val = e.target.value;
              setUrl(val);
              if (val.trim() && !showNote) setShowNote(true);
            }}
            placeholder={
              inboxFull
                ? "Inbox full — triage links first"
                : "Paste a URL to capture... (press /)"
            }
            disabled={inboxFull || isSubmitting}
            className="flex-1 min-w-0 w-full bg-transparent text-text-primary placeholder-text-ghost
                       outline-none text-sm font-mono disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowNote(!showNote)}
              className={`p-1.5 rounded-lg transition-all duration-200 hover:bg-surface-overlay
                ${showNote ? "text-accent-violet" : "text-text-muted hover:text-text-secondary"}`}
              title="Add a note"
            >
              <MessageSquare size={16} />
            </button>

            <div
              className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold
                ${inboxFull ? "bg-accent-amber-soft text-accent-amber" : "bg-accent-violet-soft text-accent-violet"}`}
            >
              {inboxLinks.length}/5
            </div>

            <button
              type="submit"
              disabled={!url.trim() || inboxFull || isSubmitting}
              className="p-1.5 rounded-lg bg-accent-violet/20 text-accent-violet
                         hover:bg-accent-violet/30 transition-all duration-200
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showNote && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 px-1">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why are you saving this?"
                  className="w-full bg-surface-raised/50 border border-border-subtle rounded-lg
                             px-3 py-2 text-sm font-mono text-text-secondary placeholder-text-ghost
                             outline-none resize-none focus:border-accent-violet/30
                             transition-colors duration-200"
                  rows={2}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-2 flex items-center gap-2 text-xs text-amber-400 px-1"
            >
              <AlertTriangle size={14} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <div className="mt-2 flex justify-center">
        <span className="text-[10px] text-text-ghost font-mono tracking-wider uppercase">
          press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-overlay text-text-muted mx-0.5">
            /
          </kbd>{" "}
          to focus ·{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-overlay text-text-muted mx-0.5">
            enter
          </kbd>{" "}
          to capture
        </span>
      </div>
    </div>
  );
}
