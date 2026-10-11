// The ONLY place that calls fetch(). Everything else goes through agentApi.js.
const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      cache: 'no-store',
    });
  } catch {
    // fetch() only rejects when the server cannot be reached at all.
    throw new Error(`Cannot reach the server at ${BASE}. Is the backend running?`);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Server returned an invalid response (${response.status}).`);
  }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message || `Request failed (${response.status}).`);
  }
  return payload.data;
}
