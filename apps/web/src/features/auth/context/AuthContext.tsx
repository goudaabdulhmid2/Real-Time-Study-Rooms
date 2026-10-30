import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
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

  // save the current session check generation in a ref so that it persists across renders
  const sessionCheckGeneration = useRef(0);

  const refreshSession = useCallback(async () => {
    // Assign a unique generation to this session check.
    const requestGeneration = ++sessionCheckGeneration.current;

    setStatus('loading');

    try {
      const currentUser = await authApi.me();

      // Ignore the result if a newer session check has started.
      if(requestGeneration !== sessionCheckGeneration.current) {
        return null;
      }

      setUser(currentUser);
      setStatus('authenticated');

      return currentUser;
    } catch (error: unknown) {

      // An older failed request must not overwrite newer auth state.
      if(requestGeneration !== sessionCheckGeneration.current) {
        return null;
      }

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

// Signs out locally and requests server-side session revocation.
// Invalidates pending session checks to prevent stale results from
// restoring an authenticated state after logout.
  const logout = useCallback(async () => {
    // Invalidate all session checks that started before logout.
    sessionCheckGeneration.current += 1;

    try {
      // Ask the backend to revoke the session and clear auth cookies.
      await authApi.logout();

      setUser(null);
      setStatus('unauthenticated');
    } catch (error: unknown) {
      // The server logout was not confirmed, but do not keep
      // showing the user as authenticated in the frontend.
      setUser(null);
      setStatus('error');

      throw error;
    }
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