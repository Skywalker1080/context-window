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
  getDocs,
  writeBatch,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import type { Collection } from "@/types";

interface CollectionsContextValue {
  collections: Collection[];
  loading: boolean;
  createCollection: (name: string) => Promise<string>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addLinkToCollection: (linkId: string, collectionId: string) => Promise<void>;
  removeLinkFromCollection: (linkId: string, collectionId: string) => Promise<void>;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time listener for user's collections
  useEffect(() => {
    if (!user) {
      setCollections([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "collections"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Collection[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "Untitled",
            userId: data.userId,
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toMillis()
                : Date.now(),
            updatedAt:
              data.updatedAt instanceof Timestamp
                ? data.updatedAt.toMillis()
                : Date.now(),
          };
        });
        setCollections(items);
        setLoading(false);
      },
      (error) => {
        console.error("Collections listener error:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const createCollection = useCallback(
    async (name: string): Promise<string> => {
      if (!user) throw new Error("Not authenticated");
      const docRef = await addDoc(collection(db, "collections"), {
        name: name.trim(),
        userId: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    },
    [user]
  );

  const renameCollection = useCallback(
    async (id: string, name: string) => {
      await updateDoc(doc(db, "collections", id), {
        name: name.trim(),
        updatedAt: Timestamp.now(),
      });
    },
    []
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      // 1. Find all links that reference this collection and remove the ID
      const linksQuery = query(
        collection(db, "links"),
        where("collectionIds", "array-contains", id),
        where("userId", "==", user.uid)
      );
      const linksSnapshot = await getDocs(linksQuery);

      if (!linksSnapshot.empty) {
        const batch = writeBatch(db);
        linksSnapshot.docs.forEach((linkDoc) => {
          batch.update(linkDoc.ref, {
            collectionIds: arrayRemove(id),
            updatedAt: Timestamp.now(),
          });
        });
        await batch.commit();
      }

      // 2. Delete the collection document
      await deleteDoc(doc(db, "collections", id));
    },
    [user]
  );

  const addLinkToCollection = useCallback(
    async (linkId: string, collectionId: string) => {
      await updateDoc(doc(db, "links", linkId), {
        collectionIds: arrayUnion(collectionId),
        updatedAt: Timestamp.now(),
      });
    },
    []
  );

  const removeLinkFromCollection = useCallback(
    async (linkId: string, collectionId: string) => {
      await updateDoc(doc(db, "links", linkId), {
        collectionIds: arrayRemove(collectionId),
        updatedAt: Timestamp.now(),
      });
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
