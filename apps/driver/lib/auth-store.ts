import { create } from 'zustand';

interface AuthState {
  token: string | null;
  driverId: string | null;
  driverName: string | null;
  setAuth: (token: string, driverId: string, name?: string) => void;
  clearAuth: () => void;
}

const isBrowser = typeof window !== 'undefined';

export const useAuthStore = create<AuthState>((set) => ({
  token: isBrowser ? localStorage.getItem('driver_token') : null,
  driverId: isBrowser ? localStorage.getItem('driver_id') : null,
  driverName: isBrowser ? localStorage.getItem('driver_name') : null,

  setAuth: (token, driverId, name) => {
    if (isBrowser) {
      localStorage.setItem('driver_token', token);
      localStorage.setItem('driver_id', driverId);
      if (name) localStorage.setItem('driver_name', name);
    }
    set({ token, driverId, driverName: name ?? null });
  },

  clearAuth: () => {
    if (isBrowser) {
      localStorage.removeItem('driver_token');
      localStorage.removeItem('driver_id');
      localStorage.removeItem('driver_name');
    }
    set({ token: null, driverId: null, driverName: null });
  },
}));
