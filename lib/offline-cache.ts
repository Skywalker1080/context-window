// IndexedDB cache for offline reads.
// Replaces Firestore's persistentLocalCache. Mutations are not queued offline.
import { openDB, type IDBPDatabase } from "idb";
import type { LinkItem, Collection } from "@/types";

const DB_NAME = "context-window-cache";
const DB_VERSION = 1;
const LINKS_STORE = "links";
const COLLECTIONS_STORE = "collections";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(LINKS_STORE)) {
          const store = db.createObjectStore(LINKS_STORE, {
            keyPath: ["userId", "id"],
          });
          store.createIndex("by_user", "userId");
        }
        if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
          const store = db.createObjectStore(COLLECTIONS_STORE, {
            keyPath: ["userId", "id"],
          });
          store.createIndex("by_user", "userId");
        }
      },
    });
  }
  return dbPromise;
}

async function replaceAllForUser<T extends { userId: string }>(
  storeName: string,
  userId: string,
  items: T[]
) {
  try {
    const db = await getDb();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const index = store.index("by_user");
    let cursor = await index.openKeyCursor(IDBKeyRange.only(userId));
    while (cursor) {
      await store.delete(cursor.primaryKey);
      cursor = await cursor.continue();
    }
    for (const item of items) {
      await store.put(item);
    }
    await tx.done;
  } catch (err) {
    console.warn(`offline-cache: replaceAll(${storeName}) failed`, err);
  }
}

async function loadAllForUser<T>(
  storeName: string,
  userId: string
): Promise<T[]> {
  try {
    const db = await getDb();
    const tx = db.transaction(storeName, "readonly");
    const index = tx.objectStore(storeName).index("by_user");
    const items = (await index.getAll(IDBKeyRange.only(userId))) as T[];
    return items;
  } catch (err) {
    console.warn(`offline-cache: loadAll(${storeName}) failed`, err);
    return [];
  }
}

async function clearForUser(storeName: string, userId: string) {
  try {
    const db = await getDb();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const index = store.index("by_user");
    let cursor = await index.openKeyCursor(IDBKeyRange.only(userId));
    while (cursor) {
      await store.delete(cursor.primaryKey);
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    console.warn(`offline-cache: clear(${storeName}) failed`, err);
  }
}

export const cacheLinks = (userId: string, items: LinkItem[]) =>
  replaceAllForUser(LINKS_STORE, userId, items);

export const loadCachedLinks = (userId: string) =>
  loadAllForUser<LinkItem>(LINKS_STORE, userId);

export const cacheCollections = (userId: string, items: Collection[]) =>
  replaceAllForUser(COLLECTIONS_STORE, userId, items);

export const loadCachedCollections = (userId: string) =>
  loadAllForUser<Collection>(COLLECTIONS_STORE, userId);

export async function clearCache(userId: string) {
  await clearForUser(LINKS_STORE, userId);
  await clearForUser(COLLECTIONS_STORE, userId);
}
