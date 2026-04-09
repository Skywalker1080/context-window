"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Tag,
  FolderOpen,
  Inbox,
  Library,
  Archive,
} from "lucide-react";
import { useLinks } from "@/contexts/LinksContext";

export function InsightsPanel() {
  const { insights, loading } = useLinks();

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  const maxActivity = Math.max(
    ...insights.recentActivity.map((d) =>
      Math.max(d.captured, d.processed)
    ),
    1
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-amber-soft">
          <BarChart3 size={18} className="text-accent-amber" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Insights</h2>
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
            Your knowledge flow
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Inbox",
            value: insights.inboxCount,
            icon: <Inbox size={14} />,
            color: "text-accent-cyan",
            bg: "bg-accent-cyan-soft",
          },
          {
            label: "Library",
            value: insights.libraryCount,
            icon: <Library size={14} />,
            color: "text-accent-emerald",
            bg: "bg-accent-emerald-soft",
          },
          {
            label: "Archived",
            value: insights.archivedCount,
            icon: <Archive size={14} />,
            color: "text-accent-amber",
            bg: "bg-accent-amber-soft",
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-3 text-center"
          >
            <div
              className={`inline-flex p-1.5 rounded-md ${stat.bg} ${stat.color} mb-2`}
            >
              {stat.icon}
            </div>
            <div className="text-xl font-bold text-text-primary font-mono">
              {stat.value}
            </div>
            <div className="text-[10px] text-text-ghost uppercase tracking-wider">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* 7-day velocity chart */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-accent-violet" />
          <span className="text-xs font-medium text-text-secondary">
            7-Day Velocity
          </span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {insights.recentActivity.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-0.5 items-end h-16 w-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{
                    height: `${Math.max((day.captured / maxActivity) * 100, 4)}%`,
                  }}
                  transition={{
                    delay: i * 0.05,
                    duration: 0.5,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  className="flex-1 rounded-t-sm bg-accent-cyan/60"
                  title={`${day.captured} captured`}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{
                    height: `${Math.max((day.processed / maxActivity) * 100, 4)}%`,
                  }}
                  transition={{
                    delay: i * 0.05 + 0.1,
                    duration: 0.5,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  className="flex-1 rounded-t-sm bg-accent-violet/60"
                  title={`${day.processed} processed`}
                />
              </div>
              <span className="text-[9px] text-text-ghost font-mono">
                {day.date}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-accent-cyan/60" />
            <span className="text-[10px] text-text-ghost">Captured</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-accent-violet/60" />
            <span className="text-[10px] text-text-ghost">Processed</span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {insights.categoryBreakdown.length > 0 && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={14} className="text-accent-emerald" />
            <span className="text-xs font-medium text-text-secondary">
              Categories
            </span>
          </div>
          <div className="space-y-2">
            {insights.categoryBreakdown.map((cat, i) => {
              const maxCount = Math.max(
                ...insights.categoryBreakdown.map((c) => c.count),
                1
              );
              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-text-secondary w-16 truncate">
                    {cat.name}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-surface-overlay overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(cat.count / maxCount) * 100}%`,
                      }}
                      transition={{
                        duration: 0.6,
                        delay: i * 0.05,
                      }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  </div>
                  <span className="text-xs text-text-ghost font-mono w-6 text-right">
                    {cat.count}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top tags */}
      {insights.topTags.length > 0 && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-accent-rose" />
            <span className="text-xs font-medium text-text-secondary">
              Top Tags
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {insights.topTags.map((tag, i) => (
              <motion.span
                key={tag.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                           bg-surface-overlay text-text-muted text-xs hover:text-accent-violet
                           hover:bg-accent-violet-soft transition-all duration-200 cursor-default"
              >
                {tag.name}
                <span className="text-[10px] text-text-ghost font-mono">
                  {tag.count}
                </span>
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {insights.totalLinks === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-text-secondary">No data yet</p>
          <p className="text-xs text-text-ghost mt-1">
            Start capturing links to see insights
          </p>
        </div>
      )}
    </div>
  );
}
