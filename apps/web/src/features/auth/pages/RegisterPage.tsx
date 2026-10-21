import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { PasswordField } from '../components/PasswordField';
import {authApi} from "../api/auth-api"
import { ApiRequestError } from '../../../lib/api-client';

import {
  registerSchema,
  type RegisterFormInput,
  type RegisterFormValues,
} from '../schemas/register.schema';

export function RegisterPage() {
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);


  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onValid = async (values: RegisterFormValues) => {
    setStatusMessage('');
    setStatusType(null);

    try {
        const user = await authApi.register({
        username: values.username,
        email: values.email,
        password: values.password,
        });

        setStatusType('success');
        setStatusMessage(
        `Account created${user.email ? ` for ${user.email}` : ''}. You can now sign in.`,
        );
    } catch (error: unknown) {
        if (error instanceof ApiRequestError) {
        const serverFields = ['username', 'email', 'password'] as const;
        let hasFieldError = false;

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
            setStatusMessage(error.message);
        }
        } else {
        setStatusMessage('Something went wrong. Please try again.');
        }

        setStatusType('error');
    }
};

  return (
    <AuthLayout variant="register">
      <form
        className="auth-form"
        noValidate
        onChange={() => {
            setStatusMessage('');
            setStatusType(null);
        }}
        onSubmit={handleSubmit(onValid)}
      >
        <div className="auth-form-intro">
          <p className="auth-eyebrow">JOIN STUDY ROOMS</p>

          <h1 className="auth-form-title">
            Create your account.
          </h1>

          <p className="auth-form-description">
            A little company for your next big idea.
          </p>
        </div>

        <div className="auth-fields">
          <FormField
            id="username"
            label="Username"
            placeholder="Choose a username"
            autoComplete="username"
            maxLength={30}
            registration={register('username')}
            error={errors.username?.message}
          />

          <FormField
            id="email"
            label="Email"
            type="email"
            placeholder="you@university.edu"
            autoComplete="email"
            maxLength={254}
            registration={register('email')}
            error={errors.email?.message}
          />

          <PasswordField
            id="password"
            label="Password"
            placeholder="Create a password"
            autoComplete="new-password"
            hint="Use 8+ characters with uppercase and lowercase letters, a number and a symbol."
            registration={register('password')}
            error={errors.password?.message}
          />

          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            registration={register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
        </div>

        <div className="auth-form-actions">
          <button
            className="auth-primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>

          {statusMessage && (
            <p
                className={`auth-form-status ${
                statusType === 'error' ? 'auth-form-status--error' : ''
                }`}
                role={statusType === 'error' ? 'alert' : 'status'}
            >
                {statusMessage}
            </p>
          )}

          <p className="auth-alternate">
            Already have an account?
            <Link to="/login">Sign In</Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}