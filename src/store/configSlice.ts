import { createSlice } from '@reduxjs/toolkit';
import type { PublicConfig } from '../shared/types.ts';

const initialState: PublicConfig = { domain: 'localhost', locale: 'it', baseUrl: '' };

/** Eager slice: seeded by the server from the whitelisted `PublicConfig`. */
export const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {},
});
