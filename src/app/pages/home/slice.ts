import { createSlice } from '@reduxjs/toolkit';
import type { HomeData } from '../../../services/types.ts';
import { createAppAsyncThunk } from '../../../store/hooks.ts';
import { REQUEST_FAILED } from '../../../store/errors.ts';
import { rootReducer } from '../../../store/rootReducer.ts';
import type { AsyncState } from '../../../store/types.ts';

export const fetchHome = createAppAsyncThunk('home/fetch', (_: void, { extra }) => extra.home.fetch());

const initialState: AsyncState<HomeData> = { status: 'idle', data: null, error: null };

export const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchHome.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchHome.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchHome.rejected, (state) => {
        state.status = 'failed';
        state.error = REQUEST_FAILED;
      });
  },
});

// Evaluating this module (i.e. loading the `route-home` chunk) registers the slice.
export const { selectSlice: selectHome } = homeSlice.injectInto(rootReducer);
