"use client";

import { motion } from "framer-motion";
import { ArrowBigDown } from "lucide-react";

export function ChangelogView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-accent-violet-soft flex items-center justify-center">
          <ArrowBigDown size={20} className="text-accent-violet" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">What's New</h2>
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
            Version 1.1.0
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 border border-border-subtle"
      >
        <div className="space-y-8">
          {/* Item 1 */}
          <div className="flex items-start gap-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-1.5 tracking-tight">
                Updated Login page with beautiful UI
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                We've completely redesigned the authentication experience. The new login page features a stunning, immersive void aesthetic with dynamic network animations, optimized Next.js Image integration, and graceful error handling for a premium first impression.
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-start gap-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-1.5 tracking-tight">
                Minor bugs fixed
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Squashed several pesky bugs under the hood. Improved error state feedback, fixed browser autofill styling issues that broke the dark theme, and enhanced overall stability across the dashboard.
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-start gap-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-1.5 tracking-tight">
                Browser extension coming soon with AI features
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Get ready! We are putting the finishing touches on our new browser extension. Soon, you'll be able to capture links instantly with one click, powered by on-device AI for automatic tagging, categorization, and smart summaries.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
