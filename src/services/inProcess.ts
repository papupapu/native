import { HOME, LISTINGS } from './fixtures.ts';
import type { SearchResult, SwPeople, Services } from './types.ts';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const SWAPI = 'https://swapi.dev/api';

/** The fake fetch: a small delay and a fixture. Used by SSR loaders and by the `/api/v1` router. */
export function createInProcessServices(latencyMs = 50): Services {
  return {
    home: {
      async fetch() {
        await delay(latencyMs);
        return HOME;
      },
    },
    listing: {
      async fetch(id) {
        await delay(latencyMs);
        return LISTINGS.find((listing) => listing.id === id) ?? null;
      },
    },
    search: {
      async fetch(query): Promise<SearchResult> {
        await delay(latencyMs);
        const needle = query.trim().toLowerCase();
        const results = LISTINGS.filter((l) => `${l.title} ${l.city}`.toLowerCase().includes(needle));
        return { query, total: results.length, results };
      },
    },
    swpeople: {
      async fetch(id): Promise<SwPeople | null> {
        const url = `${SWAPI}/people/${encodeURIComponent(id)}/`;
        const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
        return (await res.json()) as SwPeople;
      }
    },
  };
}
