/**
 * Shared Type Definitions for 961 Media
 * Consolidates models across CMS Dashboard, Public Web Frontend, and Backend Services.
 */

export interface Post {
  id: string;
  title: string;
  content: string;
  summary: string;
  author: string;
  category: string;
  status: 'draft' | 'published' | 'archived' | string;
  image: string;
  imageUrl: string;
  locationId: string;
  language: string;
  date: string;
  time: string;
  views: string | number;
  shares: string | number;
  createdAt: string;
  updatedAt: string;
}

export type Article = Post;

export interface PreviewCard {
  id: string;
  title: string;
  summary: string;
  image: string;
  imageUrl: string;
  author: string;
  date: string;
  time?: string;
  category: string;
  locationId: string;
  language: string;
  status: string;
  views?: string | number;
  shares?: string | number;
}

export interface Language {
  code: string;
  name: string;
  nativeName?: string;
  dir: 'ltr' | 'rtl';
  isDefault: boolean;
  enabled: boolean;
}

export interface Location {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  regionId: string;
  regionName: string;
  timezone?: string;
  enabled?: boolean;
}

export interface RegionalGroup {
  id: string;
  name: string;
  locations: Location[];
}

export interface ArticleQuery {
  category?: string;
  status?: string;
  locationId?: string;
  regionId?: string;
  language?: string;
  search?: string;
  limit?: string | number;
  page?: string | number;
}

export interface LanguageQuery {
  enabled?: string | boolean;
  active?: string | boolean;
}

export interface LocationQuery {
  regionId?: string;
  enabled?: string | boolean;
}
