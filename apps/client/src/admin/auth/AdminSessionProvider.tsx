'use client';

import type { AdminIdentity } from '@niro/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  AdminApiError,
  currentAdmin,
  login as loginRequest,
  logout as logoutRequest,
} from '../api';

interface AdminSessionValue {
  readonly admin: AdminIdentity | null;
  readonly loading: boolean;
  readonly error?: string;
  readonly login: (email: string, password: string) => Promise<AdminIdentity>;
  readonly logout: () => Promise<void>;
  readonly refresh: () => Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionValue | undefined>(undefined);

export function AdminSessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setAdmin(await currentAdmin());
    } catch (cause) {
      setAdmin(null);
      if (!(cause instanceof AdminApiError) || cause.status !== 401) {
        setError(cause instanceof Error ? cause.message : 'Unable to check the admin session.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void currentAdmin()
      .then((identity) => {
        if (active) setAdmin(identity);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setAdmin(null);
        if (!(cause instanceof AdminApiError) || cause.status !== 401) {
          setError(cause instanceof Error ? cause.message : 'Unable to check the admin session.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(undefined);
    const identity = await loginRequest(email, password);
    setAdmin(identity);
    return identity;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setAdmin(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ admin, loading, error, login, logout, refresh }),
    [admin, error, loading, login, logout, refresh],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const context = useContext(AdminSessionContext);
  if (!context) throw new Error('useAdminSession must be used inside AdminSessionProvider.');
  return context;
}
