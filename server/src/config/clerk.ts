import { clerkMiddleware, getAuth, requireAuth } from "@clerk/express";
import logger from './logger';

// Validate environment configuration for Clerk on startup
const secretKey = process.env.CLERK_SECRET_KEY || process.env.CLERK_API_KEY;
const publishable = process.env.CLERK_PUBLISHABLE_KEY;

if (!secretKey) {
    logger.error('Clerk secret key is not set. Set CLERK_SECRET_KEY or CLERK_API_KEY in environment.');
    throw new Error('Clerk secret key is not set. Set CLERK_SECRET_KEY or CLERK_API_KEY in environment.');
}

if (secretKey && String(secretKey).startsWith('pk_')) {
    logger.error('Clerk secret key appears to be a publishable key (pk_...). Use the secret key (sk_...) on the server.');
    throw new Error('Clerk secret key appears to be a publishable key. Use the secret key (sk_...) on the server.');
}

if (publishable && String(publishable).startsWith('sk_')) {
    logger.warn('CLERK_PUBLISHABLE_KEY looks like a secret key. Ensure secret keys are not exposed to clients.');
}

export { clerkMiddleware, getAuth, requireAuth };