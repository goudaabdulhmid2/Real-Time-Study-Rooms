import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required.')
    .max(255, 'Email is too long.')
    .email('Enter a valid email address.'),

  password: z
    .string()
    .min(1, 'Password is required.')
    .max(128, 'Password is too long.'),
});

export type LoginFormInput = z.input<typeof loginSchema>;

export type LoginFormValues = z.output<typeof loginSchema>;