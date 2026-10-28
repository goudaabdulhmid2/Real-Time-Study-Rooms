import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  ApiRequestError,
} from '../../../lib/api-client';

import {
  authApi,
  type CurrentUser,
} from '../api/auth-api';

type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';

type AuthContextValue = {
  user: CurrentUser | null;
  status: AuthStatus;
  refreshSession: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const refreshSession = useCallback(async () => {
    setStatus('loading');

    try {
      const currentUser = await authApi.me();

      setUser(currentUser);
      setStatus('authenticated');

      return currentUser;
    } catch (error: unknown) {
      setUser(null);

      if (
        error instanceof ApiRequestError &&
        error.statusCode === 401
      ) {
        setStatus('unauthenticated');
      } else {
        setStatus('error');
      }

      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();

    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return (
    <AuthContext.Provider
      value={{ user, status, refreshSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      'useAuth must be used inside an AuthProvider.',
    );
  }

  return context;
}