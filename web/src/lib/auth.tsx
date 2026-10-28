import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserDTO } from '@shared/types';
import { api, ApiError } from './api';

interface AuthContextValue {
  user: UserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  demo: () => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then(({ user: current }) => {
        if (alive) setUser(current);
      })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.warn('Falha ao verificar sessão', error);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: current } = await api.login(email, password);
    setUser(current);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user: current } = await api.register(name, email, password);
    setUser(current);
  }, []);

  const demo = useCallback(async () => {
    const { user: current } = await api.demo();
    setUser(current);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const updateName = useCallback(async (name: string) => {
    const { user: current } = await api.updateProfile(name);
    setUser(current);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, demo, logout, updateName }),
    [user, loading, login, register, demo, logout, updateName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}
