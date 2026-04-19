// Type definitions for Context Window

export type LinkStatus = "inbox" | "library" | "deleted";

export type View = "inbox" | "library" | "insights" | "collection";

export interface LinkItem {
  id: string;
  url: string;
  title: string;
  description: string;
  favicon: string;
  note: string;
  status: LinkStatus;
  category: string;
  tags: string[];
  collectionIds: string[];
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
