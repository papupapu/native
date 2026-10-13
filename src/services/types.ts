export interface SwPeople {
  name: string;
	height: string;
	mass: string;
	hair_color: string;
	skin_color: string;
	eye_color: string;
	birth_year: string;
	gender: string;
	homeworld: string;
	films: string[];
	species: string[];
	vehicles: string[];
	starships: string[];
	created: string;
	edited: string;
	url: string;
}


export interface Listing {
  id: string;
  title: string;
  city: string;
  price: number;
  rooms: number;
  mq: number;
  description: string;
}

export interface SearchResult {
  query: string;
  total: number;
  results: Listing[];
}

export interface HomeData {
  headline: string;
  featured: Listing[];
}

/**
 * Data-access contract used by thunks (`extra.services`). On the server it is backed by
 * in-process fixtures (no HTTP loopback to a BFF, unlike portal18); in the browser it calls `/api/v1`.
 */
export interface Services {
  home: { fetch(): Promise<HomeData> };
  listing: { fetch(id: string): Promise<Listing | null> };
  search: { fetch(query: string): Promise<SearchResult> };
  swpeople: { fetch(id: string): Promise<SwPeople | null> };
}
