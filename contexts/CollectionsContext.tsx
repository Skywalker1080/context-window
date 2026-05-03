"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  cacheCollections,
  loadCachedCollections,
} from "@/lib/offline-cache";
import { useAuth } from "./AuthContext";
import type { Collection } from "@/types";

interface CollectionsContextValue {
  collections: Collection[];
  loading: boolean;
  createCollection: (name: string) => Promise<string>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addLinkToCollection: (linkId: string, collectionId: string) => Promise<void>;
  removeLinkFromCollection: (
    linkId: string,
    collectionId: string
  ) => Promise<void>;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

const COLLECTIONS_TABLE = "collections";
const LINKS_TABLE = "links";

interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

function rowToCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCollections([]);
      setLoading(false);
      return;
    }
    const uid = user.uid;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const applyEvent = (
      payload: RealtimePostgresChangesPayload<CollectionRow>
    ) => {
      setCollections((prev) => {
        let next = prev;
        if (payload.eventType === "INSERT") {
          const incoming = rowToCollection(payload.new);
          if (!prev.some((c) => c.id === incoming.id)) {
            next = [...prev, incoming].sort(
              (a, b) => a.createdAt - b.createdAt
            );
          }
        } else if (payload.eventType === "UPDATE") {
          const incoming = rowToCollection(payload.new);
          next = prev.map((c) => (c.id === incoming.id ? incoming : c));
        } else if (payload.eventType === "DELETE") {
          const oldId = (payload.old as Partial<CollectionRow>)?.id;
          if (oldId) next = prev.filter((c) => c.id !== oldId);
        }
        cacheCollections(uid, next);
        return next;
      });
    };

    (async () => {
      const cached = await loadCachedCollections(uid);
      if (cancelled) return;
      if (cached.length) {
        const sorted = [...cached].sort((a, b) => a.createdAt - b.createdAt);
        setCollections(sorted);
        setLoading(false);
      }

      const { data, error } = await supabase
        .from(COLLECTIONS_TABLE)
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("Supabase select(collections) error:", error);
        setLoading(false);
      } else if (data) {
        const fresh = (data as CollectionRow[]).map(rowToCollection);
        setCollections(fresh);
        setLoading(false);
        cacheCollections(uid, fresh);
      }

      channel = supabase
        .channel(`collections:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: COLLECTIONS_TABLE,
            filter: `user_id=eq.${uid}`,
          },
          (payload) =>
            applyEvent(
              payload as RealtimePostgresChangesPayload<CollectionRow>
            )
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const createCollection = useCallback(
    async (name: string): Promise<string> => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from(COLLECTIONS_TABLE)
        .insert({ user_id: user.uid, name: name.trim() })
        .select("id")
        .single();
      if (error || !data)
        throw error ?? new Error("Failed to create collection");
      return (data as { id: string }).id;
    },
    [user]
  );

  const renameCollection = useCallback(
    async (id: string, name: string) => {
      const { error } = await supabase
        .from(COLLECTIONS_TABLE)
        .update({ name: name.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    []
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error: rpcError } = await supabase.rpc(
        "remove_collection_id_from_links",
        { p_collection_id: id }
      );
      if (rpcError) throw rpcError;
      const { error } = await supabase
        .from(COLLECTIONS_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    [user]
  );

  const addLinkToCollection = useCallback(
    async (linkId: string, collectionId: string) => {
      const { data, error: fetchError } = await supabase
        .from(LINKS_TABLE)
        .select("collection_ids")
        .eq("id", linkId)
        .single();
      if (fetchError || !data) throw fetchError ?? new Error("Link not found");
      const current: string[] =
        (data as { collection_ids: string[] | null }).collection_ids ?? [];
      if (current.includes(collectionId)) return;
      const next = [...current, collectionId];
      const { error } = await supabase
        .from(LINKS_TABLE)
        .update({ collection_ids: next })
        .eq("id", linkId);
      if (error) throw error;
    },
    []
  );

  const removeLinkFromCollection = useCallback(
    async (linkId: string, collectionId: string) => {
      const { data, error: fetchError } = await supabase
        .from(LINKS_TABLE)
        .select("collection_ids")
        .eq("id", linkId)
        .single();
      if (fetchError || !data) throw fetchError ?? new Error("Link not found");
      const current: string[] =
        (data as { collection_ids: string[] | null }).collection_ids ?? [];
      if (!current.includes(collectionId)) return;
      const next = current.filter((c) => c !== collectionId);
      const { error } = await supabase
        .from(LINKS_TABLE)
        .update({ collection_ids: next })
        .eq("id", linkId);
      if (error) throw error;
    },
    []
  );

  return (
    <CollectionsContext.Provider
      value={{
        collections,
        loading,
        createCollection,
        renameCollection,
        deleteCollection,
        addLinkToCollection,
        removeLinkFromCollection,
      }}
    >
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections() {
  const ctx = useContext(CollectionsContext);
  if (!ctx)
    throw new Error("useCollections must be used within CollectionsProvider");
  return ctx;
}
