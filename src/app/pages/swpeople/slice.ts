import { createSlice } from '@reduxjs/toolkit';
import type { SwPeople } from '../../../services/types.ts';
import { createAppAsyncThunk } from '../../../store/hooks.ts';
import { REQUEST_FAILED } from '../../../store/errors.ts';
import { rootReducer } from '../../../store/rootReducer.ts';
import type { AsyncState } from '../../../store/types.ts';

export const fetchSwPeople = createAppAsyncThunk('swpeople/fetch', (id: string, { extra }) => extra.swpeople.fetch(id));

const initialState: AsyncState<SwPeople> = { status: 'idle', data: null, error: null };

export const swpeopleSlice = createSlice({
  name: 'swpeople',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSwPeople.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSwPeople.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchSwPeople.rejected, (state) => {
        state.status = 'failed';
        state.error = REQUEST_FAILED;
      });
  },
});

export const { selectSlice: selectSwPeople } = swpeopleSlice.injectInto(rootReducer);
