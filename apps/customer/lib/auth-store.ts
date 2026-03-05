import { create } from 'zustand';

interface AuthState {
  token: string | null;
  customerId: string | null;
  tenantSlug: string | null;
  setAuth: (token: string, customerId: string, tenantSlug: string) => void;
  clearAuth: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  customerId: null,
  tenantSlug: null,
  setAuth: (token, customerId, tenantSlug) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('customer_token', token);
      localStorage.setItem('customer_id', customerId);
      localStorage.setItem('tenant_slug', tenantSlug);
    }
    set({ token, customerId, tenantSlug });
  },
  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('customer_token');
      localStorage.removeItem('customer_id');
      localStorage.removeItem('tenant_slug');
    }
    set({ token: null, customerId: null, tenantSlug: null });
  },
  hydrate: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('customer_token');
      const customerId = localStorage.getItem('customer_id');
      const tenantSlug = localStorage.getItem('tenant_slug');
      if (token && customerId) set({ token, customerId, tenantSlug });
    }
  },
}));
