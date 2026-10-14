// The ONLY place that calls fetch(). Everything else goes through agentApi.js.
const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = null, network = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.network = network;
  }
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      cache: 'no-store',
    });
  } catch (error) {
    // Browser fetch rejects for unreachable servers and blocked CORS requests.
    const reason = error instanceof Error && error.message ? ` (${error.message})` : '';
    throw new ApiError(`Backend is unavailable. Start the backend server and try again.${reason}`, { network: true });
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(`The server returned an invalid response (HTTP ${response.status}).`, { status: response.status });
  }
  if (!response.ok || payload.success === false) {
    const message = payload.error?.message || `Request failed (HTTP ${response.status}).`;
    const prefix = response.status === 400 ? 'Validation failed'
      : response.status === 404 ? 'The requested resource was not found'
        : response.status === 409 ? 'This operation conflicts with the current agent state'
          : response.status >= 500 ? 'The backend could not complete this request'
            : 'Request failed';
    throw new ApiError(`${prefix}: ${message} [HTTP ${response.status}]`, { status: response.status });
  }
  return payload.data;
}
