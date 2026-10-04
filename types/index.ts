// Type definitions for Context Window

export type LinkStatus = "inbox" | "library" | "deleted";

export type ItemKind = "link" | "image" | "document";

export interface ImageMetadata {
  hash?: string;
  blurhash?: string;
  variants?: {
    thumb?: string;
    display?: string;
  };
  exifOrientation?: number;
  /** v2: overflow pointer when doc body exceeds inline limit. */
  docRef?: string;
  [key: string]: unknown;
}

export type View = "inbox" | "library" | "insights" | "collection" | "changelog" | "settings" | "link-detail";

export type EnrichmentStatus = "pending" | "enriching" | "done" | "failed";

export interface LinkItem {
  id: string;
  kind: ItemKind;
  url: string;
  title: string;
  description: string;
  favicon: string;
  thumbnail: string;
  fileKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  metadata: ImageMetadata;
  note: string;
  status: LinkStatus;
  category: string;
  tags: string[];
  collectionIds: string[];
  summary: string;
  suggestedTags: string[];
  enrichmentStatus: EnrichmentStatus;
  enrichedAt: number | null;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

export interface Collection {
  id: string;
  name: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Category { 
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface FilterState {
  search: string;
  category: string | null;
  tags: string[];
  status: LinkStatus;
}

export interface InsightData {
  totalLinks: number;
  inboxCount: number;
  libraryCount: number;
  categoryBreakdown: { name: string; count: number }[];
  recentActivity: { date: string; captured: number; processed: number }[];
  topTags: { name: string; count: number }[];
}
