import { useAuth } from '../auth/context/AuthContext';

import './dashboard.css';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
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