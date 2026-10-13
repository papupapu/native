import { createContext } from 'react-router';
import type { AppStore } from './makeStore.ts';

/** Gives loaders the per-request (server) or per-page-load (browser) store through the router context. */
export const storeContext = createContext<AppStore>();
