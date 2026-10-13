import type { HomeData, Listing, SearchResult, SwPeople } from '../services/types.ts';

export interface AsyncState<T> {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  data: T | null;
  error: string | null;
}

/** State of the slices injected by their route chunk. Declared here (not `typeof slice`) to keep the types acyclic. */
export interface LazyLoadedSlices {
  home: AsyncState<HomeData>;
  listing: AsyncState<Listing>;
  search: AsyncState<SearchResult>;
  swpeople: AsyncState<SwPeople>;
}
