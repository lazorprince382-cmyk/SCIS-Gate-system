/** Vite base path, e.g. `/` locally or `/gate/` on VPS. */
const base = import.meta.env.BASE_URL || '/';

export function routerBasename() {
  const trimmed = base.replace(/\/$/, '');
  return trimmed || undefined;
}

export function appPath(path = '/') {
  const root = base.endsWith('/') ? base : `${base}/`;
  if (!path || path === '/') return root;
  const rel = path.startsWith('/') ? path.slice(1) : path;
  return `${root}${rel}`;
}

export function absoluteAppUrl(path = '/') {
  if (typeof window === 'undefined') return appPath(path);
  return new URL(appPath(path), window.location.origin).href;
}
