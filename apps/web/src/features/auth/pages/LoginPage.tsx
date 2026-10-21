import { Link } from 'react-router';

import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { PasswordField } from '../components/PasswordField';

export function LoginPage() {
  return (
    <AuthLayout variant="login">
      <form
        className="auth-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="auth-form-intro">
          <p className="auth-eyebrow">WELCOME BACK</p>

          <h1 className="auth-form-title">
            Pick up where
            <br />
            you left off.
          </h1>

          <p className="auth-form-description">
            Sign in to your study space. Good company awaits.
          </p>
        </div>

        <div className="auth-fields">
          <FormField
            id="email"
            label="Email"
            type="email"
            placeholder="you@university.edu"
            autoComplete="email"
            maxLength={254}
          />

          <PasswordField
            id="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </div>

        <div className="auth-form-actions">
          <button className="auth-primary-button" type="submit">
            Sign In
          </button>

          <p className="auth-alternate">
            New to Study Rooms?
            <Link to="/register">Create an account</Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}