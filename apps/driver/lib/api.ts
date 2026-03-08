import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';
const isDev = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';

const api = axios.create({ baseURL: API_URL });

// ── Request interceptor ────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('driver_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Multi-tenant: inject slug from cookie
    const slug = document.cookie
      .split('; ')
      .find(r => r.startsWith('tenant_slug='))
      ?.split('=')[1];
    if (slug) config.headers['X-Tenant-Slug'] = slug;
  }

  // Dev-only: log request (never log body — may contain card data)
  if (isDev && typeof window !== 'undefined') {
    console.groupCollapsed(`[API] → ${config.method?.toUpperCase()} ${config.url}`);
    console.log('Base URL:', config.baseURL);
    console.groupEnd();
  }

  // Track request start time for duration
  (config as any)._startTime = Date.now();
  return config;
});

// ── Response interceptor ───────────────────────────────────────────────────
api.interceptors.response.use(
  (r) => {
    const duration = Date.now() - ((r.config as any)._startTime ?? Date.now());
    const requestId = r.headers?.['x-request-id'];

    // Store last request_id globally for error boundaries
    if (typeof window !== 'undefined' && requestId) {
      (window as any).__lastRequestId = requestId;
    }

    if (isDev && typeof window !== 'undefined') {
      console.log(`[API] ← ${r.status} ${r.config.method?.toUpperCase()} ${r.config.url} (${duration}ms)${requestId ? ` | req_id: ${requestId}` : ''}`);
    }
    return r;
  },
  (err) => {
    const duration = Date.now() - ((err.config as any)?._startTime ?? Date.now());
    const requestId = err.response?.headers?.['x-request-id'];
    const status = err.response?.status;
    const message = err.response?.data?.message ?? err.message;

    if (typeof window !== 'undefined' && requestId) {
      (window as any).__lastRequestId = requestId;
    }

    // Always log errors (keep in production too — important for debugging)
    console.error(
      `[API] ✗ ${status ?? 'ERR'} ${err.config?.method?.toUpperCase()} ${err.config?.url} — ${message} (${duration}ms)${requestId ? ` | req_id: ${requestId}` : ''}`,
    );

    if (err.response?.status === 401 && typeof window !== 'undefined') {
      // Only force-redirect to login on protected pages, NOT on public pages like /quote or /book
      const publicPaths = ['/quote', '/book', '/login', '/register', '/no-tenant', '/reset-password'];
      const isPublic = publicPaths.some(p => window.location.pathname.startsWith(p));
      if (!isPublic) {
        localStorage.removeItem('customer_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;
