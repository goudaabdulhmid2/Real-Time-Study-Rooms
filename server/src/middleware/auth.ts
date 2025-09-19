import catchAsync from 'express-async-handler';
import { Request, Response, NextFunction } from "express";
import { clerkClient } from '@clerk/clerk-sdk-node';



import { getAuth } from '../config/clerk';
import ApiError from '../utils/ApiError';
import Prisma from '../config/db';
import { AppErrorCode } from '../types/errorTypes';
import logger from '../config/logger';


/**
 * Middleware to protect routes by requiring authentication.
 * - Verifies Clerk session and user ID.
 * - Syncs user data from Clerk to local DB if not present.
 * - Attaches user object to req.user for downstream access.
 */
export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {

    // Extract Clerk session info from request
    const auth = getAuth(req);
    const clerkUserId = auth.userId;

    // If no Clerk user ID, block access
    if (!clerkUserId) {
        logger.warn(`Unauthorized access attempt: No Clerk user ID. IP: ${req.ip}, Path: ${req.originalUrl}`);
        return next(new ApiError('Unauthorized access', 401, 'unauthorized', true, AppErrorCode.UNAUTHORIZED));
    }

    try {

        // Fetch user from Clerk
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        if (!clerkUser) {
            logger.warn(`Clerk user not found for userId: ${clerkUserId}. IP: ${req.ip}`);
            return next(new ApiError('Clerk user not found', 404, 'fail', true, AppErrorCode.RECORD_NOT_FOUND));
        }

        if (clerkUser.emailAddresses[0].verification?.status !== "verified") {
            logger.warn(`Email not verified for Clerk userId: ${clerkUserId}. IP: ${req.ip}`);
            return next(new ApiError("Email not verified", 403, "forbidden"));
        }

        // Prepare user data
        const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'New User';
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || undefined;
        const avatarUrl = clerkUser.imageUrl || undefined;

        // Upsert user in DB
        const user = await Prisma.user.upsert({
            where: { clerkUserId },
            update: {
                name,
                email,
                avatarUrl,
            },
            create: {
                clerkUserId,
                name,
                email,
                avatarUrl,
                role: 'user'
            }
        });

        // Attach user to request for downstream handlers
        req.user = user;
        next();
    } catch (err) {
        // Handle Clerk API/network errors
        logger.error(`Failed to fetch user from Clerk for userId: ${clerkUserId}. Error: ${err}`);
        return next(new ApiError('Failed to fetch user from Clerk', 500, 'fail', true, AppErrorCode.UNAUTHORIZED));
    }
});

/**
 * Middleware to restrict access to authorized roles.
 * Usage: restrictTo('admin', 'moderator')
 *
 * @param roles Allowed roles for the route
 */
export const restrictTo = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!roles.includes(req.user?.role as string)) {
            logger.warn(`Forbidden access attempt by userId: ${req.user?.id || 'unknown'} (role: ${req.user?.role || 'unknown'}) to path: ${req.originalUrl}`);
            return next(new ApiError("You do not have permission to access this route.", 403, 'forbidden'));
        }
        return next();
    };
};

/**
 * Middleware to require recent authentication for sensitive actions.
 * Checks the session's auth_time claim and enforces a max age.
 * Logs suspicious or failed attempts for observability and security.
 * Throws ApiError if session is missing, expired, or missing claims.
 * @param maxAgeSeconds - Maximum allowed age (in seconds) since last authentication.
 */
export const requireRecentAuth = (maxAgeSeconds: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const auth = getAuth(req);

        if (!auth || !auth.sessionClaims) {
            logger.warn(`Recent auth required: No session claims. IP: ${req.ip}, Path: ${req.originalUrl}`);
            return next(new ApiError('Unauthorized access', 401, 'unauthorized', true, AppErrorCode.UNAUTHORIZED));
        }

        const authTime = auth.sessionClaims.auth_time as number || undefined;

        if (!authTime) {
            logger.warn(`Recent auth required: Missing auth_time claim. IP: ${req.ip}, Path: ${req.originalUrl}`);
            return next(new ApiError('Missing auth_time claim', 403, 'forbidden', true));
        }

        const now = Math.floor(Date.now() / 1000);
        const age = now - authTime;

        if (age > maxAgeSeconds) {
            logger.warn(`Recent auth required: Session too old (age: ${age}s, max: ${maxAgeSeconds}s). IP: ${req.ip}, Path: ${req.originalUrl}`);
            return next(new ApiError('Re-authentication required', 403, 'forbidden', true));
        }

        next();
    };
};


