import { configureStore } from '@reduxjs/toolkit';
import type { Services } from '../services/types.ts';
import { rootReducer } from './rootReducer.ts';

export type RootState = ReturnType<typeof rootReducer>;

export interface StoreOptions {
  preloadedState?: Partial<RootState>;
  services: Services;
}

/** One store per request on the server, one per page load in the browser. Never a module singleton. */
export function makeStore({ preloadedState, services }: StoreOptions) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: services },
        serializableCheck: __DEV__,
        immutableCheck: __DEV__,
      }),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
