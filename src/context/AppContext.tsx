import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch, getStoredToken, setStoredToken } from '../lib/api';
import { applyCachedPalette, applyWebsitePalette } from '../lib/themeColor';
import type { PublicCatalogResponse, PublicUser } from '../types';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  text: string;
  kind: ToastKind;
}

interface AppContextValue {
  user: PublicUser | null;
  authLoading: boolean;
  catalog: PublicCatalogResponse | null;
  catalogLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (next: 'light' | 'dark') => void;
  toasts: ToastMessage[];
  notify: (text: string, kind?: ToastKind) => void;
  dismissToast: (id: string) => void;
  login: (email: string, password: string) => Promise<PublicUser>;
  signup: (
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => Promise<PublicUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  updateLocalBalance: (nextBalance: number) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const THEME_KEY = 'suredeal_theme';

applyCachedPalette();

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [catalog, setCatalog] = useState<PublicCatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((next: 'light' | 'dark') => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const prevMaintenanceRef = useRef<boolean | undefined>(undefined);

  const refreshCatalog = useCallback(async () => {
    try {
      const data = await apiFetch<PublicCatalogResponse>('/api/public/catalog');
      if (data && typeof data === 'object' && data.settings && typeof data.settings === 'object') {
        setCatalog(data);
        applyWebsitePalette(data.settings);
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setAuthLoading(false);
      return;
    }
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/me');
      if (res && typeof res === 'object' && res.user) {
        setUser(res.user);
      } else {
        setStoredToken('');
        setUser(null);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setStoredToken('');
        setUser(null);
      } else if (err instanceof ApiError && err.status === 503) {
        void refreshCatalog();
      }
    } finally {
      setAuthLoading(false);
    }
  }, [refreshCatalog]);

  useEffect(() => {
    void refreshCatalog();
    void refreshUser();

    const intervalId = window.setInterval(() => {
      void refreshCatalog();
    }, 15_000);

    const onFocus = () => {
      void refreshCatalog();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshCatalog();
      }
    };
    const onMaintenanceEvent = () => {
      void refreshCatalog();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('suredeal:maintenance', onMaintenanceEvent);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('suredeal:maintenance', onMaintenanceEvent);
    };
  }, [refreshCatalog, refreshUser]);

  useEffect(() => {
    const isMaint = catalog?.settings?.maintenanceMode;
    if (prevMaintenanceRef.current === true && isMaint === false && getStoredToken() && !user) {
      void refreshUser();
    }
    prevMaintenanceRef.current = isMaint;
  }, [catalog?.settings?.maintenanceMode, user, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string, referralCode?: string) => {
      const res = await apiFetch<{ token: string; user: PublicUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, referralCode }),
      });
      setStoredToken(res.token);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(() => {
    setStoredToken('');
    setUser(null);
  }, []);

  const updateLocalBalance = useCallback((nextBalance: number) => {
    setUser((prev) => (prev ? { ...prev, balance: nextBalance } : prev));
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        catalog,
        catalogLoading,
        theme,
        toggleTheme,
        setTheme,
        toasts,
        notify,
        dismissToast,
        login,
        signup,
        logout,
        refreshUser,
        refreshCatalog,
        updateLocalBalance,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
