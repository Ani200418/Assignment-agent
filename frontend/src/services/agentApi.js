// One named function per backend endpoint. Components and Redux thunks call these,
// never fetch() or raw URL strings.
import { api } from './api';

const post = (path) => api(path, { method: 'POST', body: '{}', userInitiated: true });

export function listAgents(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return api(`/agents${query ? `?${query}` : ''}`);
}
export const getAgent = (id, options = {}) => api(`/agents/${id}`, options);
export const createAgent = (body) => api('/agents', { method: 'POST', body: JSON.stringify(body), userInitiated: true });
export const updateAgent = (id, body) => api(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(body), userInitiated: true });
export const publishAgent = (id) => post(`/agents/${id}/publish`);
export const disableAgent = (id) => post(`/agents/${id}/disable`);
export const testRunAgent = (id) => post(`/agents/${id}/test-run`);
export const getAgentHistory = (id, options = {}) => api(`/agents/${id}/history`, options);
export const getHistory = (options = {}) => api('/history', options);

// Triggers, conditions, recipients, channels and actions come from the backend
// (backend/src/config/agentDefinitions.js) so the form and the server never disagree.
let definitionsPromise = null;
export function getAgentDefinitions(options = {}) {
  if (!definitionsPromise) {
    definitionsPromise = api('/agent-definitions', options).catch((error) => {
      definitionsPromise = null; // do not cache a failure: allow retry
      throw error;
    });
  }
  return definitionsPromise;
}
