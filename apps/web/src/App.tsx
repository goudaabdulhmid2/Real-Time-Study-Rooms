import {
  Navigate,
  Route,
  Routes,
} from 'react-router';

import {LoginPage}  from './features/auth/pages/LoginPage';
import {RegisterPage}  from './features/auth/pages/RegisterPage';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';
import { DashboardPage } from './features/dashboard/pages/DashboardPage';
import { GuestOnlyRoute } from './features/auth/components/GuestOnlyRoute';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route element={<GuestOnlyRoute/>}>
      
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />
      </Route>

      <Route element={<ProtectedRoute/>}>
        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;