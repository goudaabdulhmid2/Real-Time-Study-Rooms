import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { ApiRequestError } from '../../../lib/api-client';
import { authApi } from '../api/auth-api';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { PasswordField } from '../components/PasswordField';
import {
  loginSchema,
  type LoginFormInput,
  type LoginFormValues,
} from '../schemas/login.schema';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<
    'success' | 'error' | null
  >(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { refreshSession } = useAuth();

  const onValid = async (values: LoginFormValues) => {
    setStatusMessage('');
    setStatusType(null);

    try {
      await authApi.login({
        email: values.email,
        password: values.password,
      });

      const user = await refreshSession();
        if (!user) {
            setStatusType('error');
            setStatusMessage(
                'Login succeeded, but we could not load your session. Please try again.',
            );
            return;
        }

        setStatusType('success');
        setStatusMessage(`Welcome back, ${user.username ?? user.email ?? 'user'}!`);
    } catch (error: unknown) {
      if (error instanceof ApiRequestError) {
        let hasFieldError = false;

        const serverFields = ['email', 'password'] as const;

        for (const field of serverFields) {
          const message = error.fieldErrors[field];

          if (message) {
            setError(field, {
              type: 'server',
              message,
            });

            hasFieldError = true;
          }
        }

        if (!hasFieldError) {
          setStatusType('error');
          setStatusMessage(error.message);
        }

        return;
      }

      setStatusType('error');
      setStatusMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <AuthLayout variant="login">
      <form
        className="auth-form"
        noValidate
        onChange={() => {
          setStatusMessage('');
          setStatusType(null);
        }}
        onSubmit={handleSubmit(onValid)}
      >
        <FormField
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          registration={register('email')}
          error={errors.email?.message}
        />

        <PasswordField
          id="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          registration={register('password')}
          error={errors.password?.message}
        />

        <button
          className="auth-primary-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>

        {statusMessage && (
          <p
            className={`auth-form-status ${
              statusType === 'error'
                ? 'auth-form-status--error'
                : ''
            }`}
            role={statusType === 'error' ? 'alert' : 'status'}
          >
            {statusMessage}
          </p>
        )}

        <p className="auth-form-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}