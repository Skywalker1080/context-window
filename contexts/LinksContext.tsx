"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { cacheLinks, loadCachedLinks } from "@/lib/offline-cache";
import { useAuth } from "./AuthContext";
import type { LinkItem, LinkStatus, FilterState, InsightData } from "@/types";

interface LinksContextValue {
  links: LinkItem[];
  inboxLinks: LinkItem[];
  libraryLinks: LinkItem[];
  filteredLinks: LinkItem[];
  filter: FilterState;
  setFilter: (filter: Partial<FilterState>) => void;
  addLink: (url: string, note?: string, tags?: string[]) => Promise<void>;
  triageLink: (
    id: string,
    status: LinkStatus,
    category?: string,
    tags?: string[]
  ) => Promise<void>;
  updateLink: (id: string, updates: Partial<LinkItem>) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  insights: InsightData;
  loading: boolean;
  inboxFull: boolean;
}

const LinksContext = createContext<LinksContextValue | null>(null);

const INBOX_LIMIT = 9;
const LINKS_TABLE = "links";

export const DEFAULT_CATEGORIES = [
  { name: "Youtube", icon: "" },
  { name: "Documentation", icon: "" },
  { name: "Github", icon: "" },
  { name: "Twitter (X)", icon: "" },
  { name: "Reddit", icon: "" },
  { name: "Substack", icon: "" },
  { name: "Linkedin", icon: "" },
  { name: "Tool", icon: "" },
  { name: "Website", icon: "" },
];

interface LinkRow {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  description: string | null;
  favicon: string | null;
  note: string | null;
  status: LinkStatus;
  category: string | null;
  tags: string[] | null;
  collection_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

function rowToLink(row: LinkRow): LinkItem {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title ?? "",
    description: row.description ?? "",
    favicon: row.favicon ?? "",
    note: row.note ?? "",
    status: row.status,
    category: row.category ?? "Website",
    tags: row.tags ?? [],
    collectionIds: row.collection_ids ?? [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

async function fetchUrlMetadata(url: string) {
  const fallback = {
    title: new URL(url).hostname.replace("www.", ""),
    description: "",
    favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
  };

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      );
      if (response.ok) {
        const data = await response.json();
        return {
          title: data.title || fallback.title,
          description: data.author_name || "",
          favicon: fallback.favicon,
        };
      }
    } catch {
      // fall through to scraper
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      `/api/scrape?url=${encodeURIComponent(url)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!response.ok) return fallback;
    const data = await response.json();
    return {
      title: data.title || fallback.title,
      description: data.description || "",
      favicon: data.favicon || fallback.favicon,
    };
  } catch {
    return fallback;
  }
}

function categorizeUrl(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
    return "Youtube";
  if (hostname.includes("github.com") || hostname.includes("gitlab.com"))
    return "Github";
  if (hostname.includes("twitter.com") || hostname.includes("x.com"))
    return "Twitter (X)";
  if (hostname.includes("reddit.com")) return "Reddit";
  if (hostname.includes("substack.com")) return "Substack";
  if (
    hostname.includes("docs.") ||
    url.includes("/docs") ||
    url.includes("/documentation")
  )
    return "Documentation";
  return "Website";
}

export function LinksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilterState] = useState<FilterState>({
    search: "",
    category: null,
    tags: [],
    status: "library",
  });

  const linksRef = useRef<LinkItem[]>([]);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  useEffect(() => {
    if (!user) {
      setLinks([]);
      setLoading(false);
      return;
    }
    const uid = user.uid;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const applyEvent = (
      payload: RealtimePostgresChangesPayload<LinkRow>
    ) => {
      setLinks((prev) => {
        let next = prev;
        if (payload.eventType === "INSERT") {
          const incoming = rowToLink(payload.new);
          if (!prev.some((l) => l.id === incoming.id)) {
            next = [incoming, ...prev];
          }
        } else if (payload.eventType === "UPDATE") {
          const incoming = rowToLink(payload.new);
          next = prev.map((l) => (l.id === incoming.id ? incoming : l));
        } else if (payload.eventType === "DELETE") {
          const oldId = (payload.old as Partial<LinkRow>)?.id;
          if (oldId) next = prev.filter((l) => l.id !== oldId);
        }
        cacheLinks(uid, next);
        return next;
      });
    };

    (async () => {
      const cached = await loadCachedLinks(uid);
      if (cancelled) return;
      if (cached.length) {
        const sorted = [...cached].sort((a, b) => b.createdAt - a.createdAt);
        setLinks(sorted);
        setLoading(false);
      }

      const { data, error } = await supabase
        .from(LINKS_TABLE)
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Supabase select(links) error:", error);
        setLoading(false);
      } else if (data) {
        const fresh = (data as LinkRow[]).map(rowToLink);
        setLinks(fresh);
        setLoading(false);
        cacheLinks(uid, fresh);
      }

      channel = supabase
        .channel(`links:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: LINKS_TABLE,
            filter: `user_id=eq.${uid}`,
          },
          (payload) =>
            applyEvent(payload as RealtimePostgresChangesPayload<LinkRow>)
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const inboxLinks = links.filter((l) => l.status === "inbox");
  const libraryLinks = links.filter((l) => l.status === "library");
  const inboxFull = inboxLinks.length >= INBOX_LIMIT;

  const filteredLinks = links.filter((l) => {
    if (l.status !== filter.status) return false;
    if (filter.category && l.category !== filter.category) return false;
    if (
      filter.tags.length > 0 &&
      !filter.tags.every((t) => l.tags.includes(t))
    )
      return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return (
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.note.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const addLink = useCallback(
    async (url: string, note?: string, tags?: string[]) => {
      if (!user) return;
      if (
        linksRef.current.filter((l) => l.status === "inbox").length >=
        INBOX_LIMIT
      ) {
        throw new Error(
          `Inbox is full! Triage existing links before adding more. (${INBOX_LIMIT} max)`
        );
      }

      const category = categorizeUrl(url);
      const fallbackTitle = new URL(url).hostname.replace("www.", "");
      const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;

      const { data, error } = await supabase
        .from(LINKS_TABLE)
        .insert({
          user_id: user.uid,
          url,
          title: fallbackTitle,
          description: "",
          favicon: fallbackFavicon,
          note: note ?? "",
          status: "inbox",
          category,
          tags: tags ?? [],
          collection_ids: [],
        })
        .select("id")
        .single();

      if (error || !data) {
        throw error ?? new Error("Failed to create link");
      }

      const newId = (data as { id: string }).id;

      fetchUrlMetadata(url)
        .then(async (metadata) => {
          if (
            metadata.title !== fallbackTitle ||
            metadata.description ||
            metadata.favicon !== fallbackFavicon
          ) {
            await supabase
              .from(LINKS_TABLE)
              .update({
                title: metadata.title || fallbackTitle,
                description: metadata.description || "",
                favicon: metadata.favicon || fallbackFavicon,
              })
              .eq("id", newId);
          }
        })
        .catch((err) => console.error("Failed to fetch metadata:", err));
    },
    [user]
  );

  const triageLink = useCallback(
    async (
      id: string,
      status: LinkStatus,
      category?: string,
      tags?: string[]
    ) => {
      const updates: Record<string, unknown> = { status };
      if (category) updates.category = category;
      if (tags) updates.tags = tags;
      const { error } = await supabase
        .from(LINKS_TABLE)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    []
  );

  const updateLink = useCallback(
    async (id: string, updates: Partial<LinkItem>) => {
      const row: Record<string, unknown> = {};
      if (updates.url !== undefined) row.url = updates.url;
      if (updates.title !== undefined) row.title = updates.title;
      if (updates.description !== undefined)
        row.description = updates.description;
      if (updates.favicon !== undefined) row.favicon = updates.favicon;
      if (updates.note !== undefined) row.note = updates.note;
      if (updates.status !== undefined) row.status = updates.status;
      if (updates.category !== undefined) row.category = updates.category;
      if (updates.tags !== undefined) row.tags = updates.tags;
      if (updates.collectionIds !== undefined)
        row.collection_ids = updates.collectionIds;
      const { error } = await supabase
        .from(LINKS_TABLE)
        .update(row)
        .eq("id", id);
      if (error) throw error;
    },
    []
  );

  const deleteLink = useCallback(async (id: string) => {
    const { error } = await supabase.from(LINKS_TABLE).delete().eq("id", id);
    if (error) throw error;
  }, []);

  const setFilter = useCallback((partial: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  }, []);

  const insights: InsightData = {
    totalLinks: links.length,
    inboxCount: inboxLinks.length,
    libraryCount: libraryLinks.length,
    categoryBreakdown: DEFAULT_CATEGORIES.map((cat) => ({
      name: cat.name,
      count: links.filter(
        (l) => l.category === cat.name && l.status === "library"
      ).length,
    })).filter((c) => c.count > 0),
    recentActivity: (() => {
      const days = 7;
      const result: { date: string; captured: number; processed: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString("en-US", { weekday: "short" });
        const dayStart = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate()
        ).getTime();
        const dayEnd = dayStart + 86400000;
        result.push({
          date: dateStr,
          captured: links.filter(
            (l) => l.createdAt >= dayStart && l.createdAt < dayEnd
          ).length,
          processed: links.filter(
            (l) =>
              l.updatedAt >= dayStart &&
              l.updatedAt < dayEnd &&
              l.status !== "inbox"
          ).length,
        });
      }
      return result;
    })(),
    topTags: (() => {
      const tagMap = new Map<string, number>();
      links
        .filter((l) => l.status === "library")
        .forEach((l) =>
          l.tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1))
        );
      return Array.from(tagMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    })(),
  };

  return (
    <LinksContext.Provider
      value={{
        links,
        inboxLinks,
        libraryLinks,
        filteredLinks,
        filter,
        setFilter,
        addLink,
        triageLink,
        updateLink,
        deleteLink,
        insights,
        loading,
        inboxFull,
      }}
    >
      {children}
    </LinksContext.Provider>
  );
}

export function useLinks() {
  const ctx = useContext(LinksContext);
  if (!ctx) throw new Error("useLinks must be used within LinksProvider");
  return ctx;
}
