import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('customer_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Multi-tenant: inject slug from cookie
    const slug = document.cookie
      .split('; ')
      .find(r => r.startsWith('tenant_slug='))
      ?.split('=')[1];
    if (slug) config.headers['X-Tenant-Slug'] = slug;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
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
