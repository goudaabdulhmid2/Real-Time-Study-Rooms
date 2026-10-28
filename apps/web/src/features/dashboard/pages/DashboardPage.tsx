import {useState} from 'react';
import {useNavigate} from 'react-router';

import { useAuth } from '../../auth/context/AuthContext';
import {ApiRequestError} from '../../../lib/api-client';

import './dashboard.css';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError('');

    try{
      await logout();
      navigate('/login', { replace: true });
    }catch (error: unknown) {
      setLogoutError(
        error instanceof ApiRequestError
          ? error.message
          : 'Unable to log out. Please try again.'
      )
    } finally {
      setIsLoggingOut(false);
    }
  } 

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <button
        className="dashboard-logout"
        type="button"
        onClick={() => void handleLogout()}
        disabled={isLoggingOut}
      >
      {isLoggingOut ? 'Signing out...' : 'Sign Out'}
      </button>

      {logoutError && (
        <p role="alert" className="dashboard-logout-error">
          {logoutError}
        </p>
      )}
        <p className="dashboard-eyebrow">REAL-TIME STUDY ROOMS</p>

        <h1>Welcome to your dashboard.</h1>

        <p>
          You're signed in. Your study room experience will start here.
        </p>

        <div className="dashboard-user">
          <span>Current user ID</span>
          <code>{user?.userId ?? 'Unavailable'}</code>
        </div>
      </div>
    </main>
  );
}