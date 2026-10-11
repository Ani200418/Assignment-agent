// One named function per backend endpoint. Components and Redux thunks call these,
// never fetch() or raw URL strings.
import { api } from './api';

const post = (path) => api(path, { method: 'POST', body: '{}' });

export function listAgents(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return api(`/agents${query ? `?${query}` : ''}`);
}
export const getAgent = (id) => api(`/agents/${id}`);
export const createAgent = (body) => api('/agents', { method: 'POST', body: JSON.stringify(body) });
export const updateAgent = (id, body) => api(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const publishAgent = (id) => post(`/agents/${id}/publish`);
export const disableAgent = (id) => post(`/agents/${id}/disable`);
export const testRunAgent = (id) => post(`/agents/${id}/test-run`);
export const getAgentHistory = (id) => api(`/agents/${id}/history`);
export const getHistory = () => api('/history');

// Triggers, conditions, recipients, channels and actions come from the backend
// (backend/src/config/agentDefinitions.js) so the form and the server never disagree.
let definitionsPromise = null;
export function getAgentDefinitions() {
  if (!definitionsPromise) {
    definitionsPromise = api('/agent-definitions').catch((error) => {
      definitionsPromise = null; // do not cache a failure: allow retry
      throw error;
    });
  }
  return definitionsPromise;
}
