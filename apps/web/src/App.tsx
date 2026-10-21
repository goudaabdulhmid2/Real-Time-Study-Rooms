import {
  Navigate,
  Route,
  Routes,
} from 'react-router';

import {LoginPage}  from './features/auth/pages/LoginPage';
import {RegisterPage}  from './features/auth/pages/RegisterPage';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/register"
        element={<RegisterPage />}
      />

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;