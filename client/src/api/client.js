/**
 * api/client.js
 * -------------
 * PATTERN: ADAPTER — wraps the native fetch API into a clean
 * interface that all pages use.  If we ever switch to axios,
 * only this file changes.
 *
 * All requests go to /api/... which Vite proxies to Express
 * in dev, and Express serves directly in production.
 */

const BASE = '/api';

function getToken() {
  return localStorage.getItem('omni_token');
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get:    path        => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  put:    (path, body) => request('PUT',    path, body),
  patch:  (path, body) => request('PATCH',  path, body),
  delete: path        => request('DELETE',  path),
};