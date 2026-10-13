import { createSlice } from '@reduxjs/toolkit';
import type { SearchResult } from '../../../services/types.ts';
import { createAppAsyncThunk } from '../../../store/hooks.ts';
import { REQUEST_FAILED } from '../../../store/errors.ts';
import { rootReducer } from '../../../store/rootReducer.ts';
import type { AsyncState } from '../../../store/types.ts';

export const fetchSearch = createAppAsyncThunk('search/fetch', (query: string, { extra }) => extra.search.fetch(query));

const initialState: AsyncState<SearchResult> = { status: 'idle', data: null, error: null };

export const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSearch.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSearch.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchSearch.rejected, (state) => {
        state.status = 'failed';
        state.error = REQUEST_FAILED;
      });
  },
});

export const { selectSlice: selectSearch } = searchSlice.injectInto(rootReducer);
