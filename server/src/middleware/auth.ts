import catchAsync from 'express-async-handler';
import { Request, Response, NextFunction } from "express";
import { clerkClient } from '@clerk/clerk-sdk-node';
import { getAuth } from '../config/clerk';
import ApiError from '../utils/ApiError';
import Prisma from '../config/db';
import { AppErrorCode } from '../types/errorTypes';


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
        return next(new ApiError('Unauthorized access', 401, 'unauthorized', true, AppErrorCode.UNAUTHORIZED));
    }

    // Try to find user in local DB
    let user = await Prisma.user.findUnique({
        where: { clerkUserId }
    });

    // If user not found, fetch from Clerk and create in DB
    if (!user) {
        try {
            const clerkUser = await clerkClient.users.getUser(clerkUserId);
            if (!clerkUser) {
                return next(new ApiError('Clerk user not found', 404, 'fail', true, AppErrorCode.RECORD_NOT_FOUND));
            }
            const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'New User';
            const email = clerkUser.emailAddresses?.[0]?.emailAddress || undefined;
            const avatarUrl = clerkUser.imageUrl || undefined;
            user = await Prisma.user.create({
                data: {
                    clerkUserId,
                    name,
                    email,
                    role: 'user',
                    avatarUrl
                }
            });
        } catch (err) {
            // Handle Clerk API/network errors
            return next(new ApiError('Failed to fetch user from Clerk', 500, 'error', true));
        }
    }

    // Attach user to request for downstream handlers
    req.user = user;
    next();
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
            return next(new ApiError("You do not have permission to access this route.", 403, 'forbidden'));
        }
        return next();
    };
};


