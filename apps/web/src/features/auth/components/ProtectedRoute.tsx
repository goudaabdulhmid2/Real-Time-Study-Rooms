import { Navigate, Outlet } from 'react-router';

import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { status, refreshSession } = useAuth();

  if (status === 'loading') {
    return (
      <main className="auth-gate">
        <p>Checking your session...</p>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'error') {
    return (
      <main className="auth-gate">
        <p>We could not verify your session.</p>

        <button
          className="auth-primary-button"
          type="button"
          onClick={() => {
            void refreshSession();
          }}
        >
          Try again
        </button>
      </main>
    );
  }

  return <Outlet />;
}