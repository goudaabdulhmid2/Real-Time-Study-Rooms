import { useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

type PasswordFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  registration?: UseFormRegisterReturn;
  error?: string;
};

export function PasswordField({
  id,
  label,
  placeholder,
  autoComplete,
  hint,
  required = true,
  registration,
  error,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [
    hint ? hintId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={`auth-field ${error ? 'auth-field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>

      <div className="auth-input-wrap">
        <input
          {...registration}
          className="auth-input"
          id={id}
          name={id}
          type={isVisible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          maxLength={128}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />

        <button
          className="auth-password-toggle"
          type="button"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((current) => !current)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {isVisible && <path d="m4 4 16 16" />}
          </svg>

          <span>{isVisible ? 'Hide' : 'Show'}</span>
        </button>
      </div>

      {hint && (
        <p className="auth-field-hint" id={hintId}>
          {hint}
        </p>
      )}

      {error && (
        <p className="auth-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}