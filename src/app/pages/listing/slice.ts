import { createSlice } from '@reduxjs/toolkit';
import type { Listing } from '../../../services/types.ts';
import { createAppAsyncThunk } from '../../../store/hooks.ts';
import { REQUEST_FAILED } from '../../../store/errors.ts';
import { rootReducer } from '../../../store/rootReducer.ts';
import type { AsyncState } from '../../../store/types.ts';

export const fetchListing = createAppAsyncThunk('listing/fetch', (id: string, { extra }) => extra.listing.fetch(id));

const initialState: AsyncState<Listing> = { status: 'idle', data: null, error: null };

export const listingSlice = createSlice({
  name: 'listing',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchListing.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchListing.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchListing.rejected, (state) => {
        state.status = 'failed';
        state.error = REQUEST_FAILED;
      });
  },
});

export const { selectSlice: selectListing } = listingSlice.injectInto(rootReducer);
