import { z } from 'zod';

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters.')
      .max(30, 'Username must not exceed 30 characters.')
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'Use only letters, numbers, and underscores.',
      ),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Email is required.')
      .max(255, 'Email must not exceed 254 characters.')
      .email('Enter a valid email address.'),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password must not exceed 128 characters.')
      .regex(/[A-Z]/, 'Add at least one uppercase letter.')
      .regex(/[a-z]/, 'Add at least one lowercase letter.')
      .regex(/[0-9]/, 'Add at least one number.')
      .regex(
        /[^A-Za-z0-9]/,
        'Add at least one symbol.',
      ),

    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password.'),
  })
  .refine(
    (values) => values.password === values.confirmPassword,
    {
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    },
  );

export type RegisterFormInput = z.input<typeof registerSchema>;
export type RegisterFormValues = z.output<typeof registerSchema>;