export interface HNStory {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  author: string;
  created_at: string;
  num_comments: number;
}

export interface HNItem {
  id: number;
  title: string;
  points: number;
  author: string;
  url: string | null;
  text: string | null;
  created_at: string;
  children: HNComment[];
}

export interface HNComment {
  id: number;
  author: string;
  text: string | null;
  created_at: string;
  points: number;
  children: HNComment[];
}

export interface HNUser {
  id: string;
  karma: number;
  created_at: string;
  about: string | null;
  submission_count: number;
  comment_count: number;
}

const BASE = 'https://hn.algolia.com/api/v1';

export async function fetchTopStories(page = 0): Promise<{ hits: HNStory[]; nbPages: number; page: number }> {
  const res = await fetch(`${BASE}/search?tags=front_page&page=${page}`);
  if (!res.ok) throw new Error(`Failed to fetch top stories: ${res.status}`);
  return res.json();
}

export async function fetchStory(id: string): Promise<HNItem> {
  const res = await fetch(`${BASE}/items/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch item ${id}: ${res.status}`);
  return res.json();
}

export async function fetchUser(username: string): Promise<HNUser> {
  const res = await fetch(`${BASE}/users/${username}`);
  if (!res.ok) throw new Error(`Failed to fetch user ${username}: ${res.status}`);
  return res.json();
}

export interface SearchResult {
  hits: HNStory[];
  nbPages: number;
  page: number;
  query: string;
}

export async function searchStories(query: string, page = 0): Promise<SearchResult> {
  const q = encodeURIComponent(query);
  const res = await fetch(`${BASE}/search?query=${q}&page=${page}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}
