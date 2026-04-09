"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import type { LinkItem, LinkStatus, FilterState, InsightData } from "@/types";

interface LinksContextValue {
  links: LinkItem[];
  inboxLinks: LinkItem[];
  libraryLinks: LinkItem[];
  filteredLinks: LinkItem[];
  filter: FilterState;
  setFilter: (filter: Partial<FilterState>) => void;
  addLink: (url: string, note?: string) => Promise<void>;
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

const INBOX_LIMIT = 5;

export const DEFAULT_CATEGORIES = [
  { name: "General", icon: "📌", color: "#7c3aed" },
  { name: "GitHub", icon: "🐙", color: "#06b6d4" },
  { name: "Research", icon: "🔬", color: "#10b981" },
  { name: "Video", icon: "🎬", color: "#f59e0b" },
  { name: "Social", icon: "💬", color: "#f43f5e" },
  { name: "News", icon: "📰", color: "#8b5cf6" },
  { name: "Tools", icon: "🛠️", color: "#06b6d4" },
  { name: "Design", icon: "🎨", color: "#ec4899" },
];

async function fetchUrlMetadata(url: string) {
  const fallback = {
    title: new URL(url).hostname.replace("www.", ""),
    description: "",
    favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
  };
  try {
    const response = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`
    );
    if (!response.ok) return fallback;
    const data = await response.json();
    return {
      title: data.data?.title || fallback.title,
      description: data.data?.description || "",
      favicon: data.data?.logo?.url || fallback.favicon,
    };
  } catch {
    return fallback;
  }
}

function categorizeUrl(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("github.com") || hostname.includes("gitlab.com"))
    return "GitHub";
  if (
    hostname.includes("youtube.com") ||
    hostname.includes("youtu.be") ||
    hostname.includes("vimeo.com")
  )
    return "Video";
  if (
    hostname.includes("twitter.com") ||
    hostname.includes("x.com") ||
    hostname.includes("reddit.com")
  )
    return "Social";
  if (
    hostname.includes("arxiv.org") ||
    hostname.includes("scholar.google") ||
    hostname.includes("researchgate.net")
  )
    return "Research";
  if (
    hostname.includes("figma.com") ||
    hostname.includes("dribbble.com") ||
    hostname.includes("behance.net")
  )
    return "Design";
  return "General";
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

  useEffect(() => {
    if (!user) {
      setLinks([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "links"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: LinkItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            url: data.url,
            title: data.title || "",
            description: data.description || "",
            favicon: data.favicon || "",
            note: data.note || "",
            status: data.status || "inbox",
            category: data.category || "General",
            tags: data.tags || [],
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toMillis()
                : Date.now(),
            updatedAt:
              data.updatedAt instanceof Timestamp
                ? data.updatedAt.toMillis()
                : Date.now(),
            userId: data.userId,
          };
        });
        setLinks(items);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore listener error:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const inboxLinks = links.filter((l) => l.status === "inbox");
  const libraryLinks = links.filter((l) => l.status === "library");
  const inboxFull = inboxLinks.length >= INBOX_LIMIT;

  const filteredLinks = links.filter((l) => {
    if (l.status !== filter.status) return false;
    if (filter.category && l.category !== filter.category) return false;
    if (filter.tags.length > 0 && !filter.tags.every((t) => l.tags.includes(t)))
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
    async (url: string, note?: string) => {
      if (!user) return;
      if (inboxLinks.length >= INBOX_LIMIT) {
        throw new Error(
          `Inbox is full! Triage existing links before adding more. (${INBOX_LIMIT} max)`
        );
      }

      const category = categorizeUrl(url);
      const fallbackTitle = new URL(url).hostname.replace("www.", "");
      const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;

      // 1. Instantly save minimal data to unblock UI
      const docRef = await addDoc(collection(db, "links"), {
        url,
        title: fallbackTitle,
        description: "",
        favicon: fallbackFavicon,
        note: note || "",
        status: "inbox" as LinkStatus,
        category,
        tags: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        userId: user.uid,
      });

      // 2. Fetch rich metadata in background
      fetchUrlMetadata(url)
        .then(async (metadata) => {
          // Only update if we got better data
          if (
            metadata.title !== fallbackTitle ||
            metadata.description ||
            metadata.favicon !== fallbackFavicon
          ) {
            await updateDoc(docRef, {
              title: metadata.title || fallbackTitle,
              description: metadata.description || "",
              favicon: metadata.favicon || fallbackFavicon,
            });
          }
        })
        .catch((err) => console.error("Failed to fetch metadata:", err));
    },
    [user, inboxLinks.length]
  );

  const triageLink = useCallback(
    async (
      id: string,
      status: LinkStatus,
      category?: string,
      tags?: string[]
    ) => {
      const updates: Record<string, unknown> = {
        status,
        updatedAt: Timestamp.now(),
      };
      if (category) updates.category = category;
      if (tags) updates.tags = tags;
      await updateDoc(doc(db, "links", id), updates);
    },
    []
  );

  const updateLink = useCallback(
    async (id: string, updates: Partial<LinkItem>) => {
      const { id: _id, ...rest } = updates;
      void _id;
      await updateDoc(doc(db, "links", id), {
        ...rest,
        updatedAt: Timestamp.now(),
      });
    },
    []
  );

  const deleteLink = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "links", id));
  }, []);

  const setFilter = useCallback((partial: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Compute insights
  const insights: InsightData = {
    totalLinks: links.length,
    inboxCount: inboxLinks.length,
    libraryCount: libraryLinks.length,
    archivedCount: links.filter((l) => l.status === "archived").length,
    categoryBreakdown: DEFAULT_CATEGORIES.map((cat) => ({
      name: cat.name,
      count: links.filter(
        (l) => l.category === cat.name && l.status === "library"
      ).length,
      color: cat.color,
    })).filter((c) => c.count > 0),
    recentActivity: (() => {
      const days = 7;
      const result: { date: string; captured: number; processed: number }[] =
        [];
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
