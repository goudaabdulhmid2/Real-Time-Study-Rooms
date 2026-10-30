import { Navigate, Outlet } from 'react-router';

import { useAuth } from '../context/AuthContext';

export function GuestOnlyRoute() {
  const { status } = useAuth();

  // Wait until the initial session check finishes.
  if (status === 'loading') {
    return (
      <main className="auth-gate">
        <p>Checking your session...</p>
      </main>
    );
  }

  // Authenticated users should not access guest-only pages.
  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  // Unauthenticated users can access login and registration.
  // Also allow access when session verification has a temporary error.
  return <Outlet />;
}