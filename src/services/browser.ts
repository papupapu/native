import type { HomeData, Listing, SearchResult, SwPeople, Services } from './types.ts';

async function getJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return (await response.json()) as T;
}

/** Client-side navigation goes through the same `/api/v1` router that is mounted on the server. */
export function createBrowserServices(): Services {
  return {
    home: {
      async fetch() {
        const data = await getJson<HomeData>('/api/v1/home');
        if (!data) throw new Error('home: empty response');
        return data;
      },
    },
    search: {
      async fetch(query) {
        const data = await getJson<SearchResult>(`/api/v1/search?q=${encodeURIComponent(query)}`);
        if (!data) throw new Error('search: empty response');
        return data;
      },
    },
    listing: {
      fetch(id) {
        return getJson<Listing>(`/api/v1/listings/${encodeURIComponent(id)}`);
      },
    },
    swpeople: {
      fetch(id) {
        return getJson<SwPeople>(`/api/v1/swpeople/${encodeURIComponent(id)}`);
      },
    },
  };
}
