// Type definitions for Context Window

export type LinkStatus = "inbox" | "library" | "archived" | "deleted";

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
  createdAt: number;
  updatedAt: number;
  userId: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
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
  archivedCount: number;
  categoryBreakdown: { name: string; count: number; color: string }[];
  recentActivity: { date: string; captured: number; processed: number }[];
  topTags: { name: string; count: number }[];
}
