import type { HTMLInputTypeAttribute } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

type FormFieldProps = {
  id: string;
  label: string;
  type?: HTMLInputTypeAttribute;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
  registration?: UseFormRegisterReturn;
  error?: string;
};

export function FormField({
  id,
  label,
  type = 'text',
  placeholder,
  autoComplete,
  required = true,
  maxLength,
  registration,
  error,
}: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={`auth-field ${error ? 'auth-field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>

      <input
        {...registration}
        className="auth-input"
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />

      {error && (
        <p className="auth-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}