const API_BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = err.error || res.statusText || 'Request failed';
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    const e = new Error(message);
    e.status = res.status;
    throw e;
  }
  if (res.status === 204) return null;
  return res.json();
}

export function getWsUrl(officeId) {
  const base = (import.meta.env.VITE_WS_URL || window.location.origin).replace(/^http/, 'ws');
  const path = officeId ? `/ws?officeId=${officeId}` : '/ws';
  return `${base.replace(/\/$/, '')}${path}`;
}
