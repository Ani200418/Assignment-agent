import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { disableAgent, listAgents, publishAgent, testRunAgent } from '../services/agentApi';

// The list is ALWAYS the full list from the database; module/status/search filtering
// happens in the page, so the per-module "active" counts never depend on the selected filter.
export const fetchAgents = createAsyncThunk('agents/fetch', ({ userInitiated = false } = {}) => listAgents({}, { userInitiated }));

const ACTIONS = { publish: publishAgent, disable: disableAgent, 'test-run': testRunAgent };

// publish / disable / test-run. The list is refreshed afterwards whether the action
// succeeded or failed, so the UI always shows what the database really contains.
export const runAgentAction = createAsyncThunk('agents/action', async ({ id, verb }, { dispatch }) => {
  try {
    return await ACTIONS[verb](id);
  } finally {
    await dispatch(fetchAgents());
  }
});

const initialState = { items: [], loaded: false, loading: false, error: null, userInitiatedError: null, filters: { module: 'All', status: 'All', search: '' } };

const slice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
    setFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgents.pending, (state) => { state.loading = true; state.error = null; state.userInitiatedError = null; })
      .addCase(fetchAgents.fulfilled, (state, action) => { state.loading = false; state.loaded = true; state.error = null; state.userInitiatedError = null; state.items = action.payload; })
      .addCase(fetchAgents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.userInitiatedError = action.meta.arg?.userInitiated ? action.error.message : null;
      });
  },
});

export const { clearError, setFilters } = slice.actions;
export default slice.reducer;
