import axios from 'axios';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://chauffeur-saas-production.up.railway.app';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const detail = typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
    const prefix = status ? `Request failed (${status})` : 'Request failed';
    error.message = detail ? `${prefix} ${detail}` : prefix;
    return Promise.reject(error);
  },
);

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }
}

if (typeof window !== 'undefined') {
  accessToken = localStorage.getItem('accessToken');
}

api.interceptors.request.use((config) => {
  if (!accessToken && typeof window !== 'undefined') {
    accessToken = localStorage.getItem('accessToken');
  }
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config.__isRetryRequest) {
      error.config.__isRetryRequest = true;
      try {
        const refreshToken =
          typeof window !== 'undefined'
            ? localStorage.getItem('refreshToken')
            : null;
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );
        accessToken = res.data.accessToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', res.data.accessToken);
          if (res.data.refreshToken) {
            localStorage.setItem('refreshToken', res.data.refreshToken);
          }
        }
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        return api.request(error.config);
      } catch {
        accessToken = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
