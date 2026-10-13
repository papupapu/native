import { combineSlices } from '@reduxjs/toolkit';
import { configSlice } from './configSlice.ts';
import type { LazyLoadedSlices } from './types.ts';

/**
 * Eager slices only. Page slices call `rootReducer.inject(slice)` when their route chunk is
 * evaluated. The reducer is shared by every per-request store: injecting is idempotent and the
 * slice state appears in a store at the first action it sees.
 */
export const rootReducer = combineSlices(configSlice).withLazyLoadedSlices<LazyLoadedSlices>();
