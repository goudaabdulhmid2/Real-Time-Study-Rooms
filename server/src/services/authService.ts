import { clerkClient } from '@clerk/clerk-sdk-node';
import { Request } from 'express';

import Prisma from '../config/db';
import ApiError from '../utils/ApiError';
import { AppErrorCode } from '../types/errorTypes';
import logger from '../config/logger';
import { getAuth } from '../config/clerk';



export class AuthService {
    /**
     * Fetches a user profile from the local DB by userId.
     * Throws ApiError if not found.
     */
    static async getUserProfile(userId: string) {
        const user = await Prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new ApiError('User not found', 404, 'fail', true, AppErrorCode.RECORD_NOT_FOUND);
        }

        return user;
    }

    /**
     * Updates a user's profile in Clerk and the local DB.
     * Throws ApiError if update fails in either system.
     */
    static async updateUserProfile(
        userId: string,
        newData: {
            firstName?: string;
            lastName?: string;
            birthDate?: Date;
            avatarUrl?: string;
        },
        oldData: any
    ) {
        // Store original Clerk data for rollback
        let originalClerkUser: any = null;
        try {
            // Fetch original Clerk user data
            originalClerkUser = await clerkClient.users.getUser(userId);

            // Prepare update data, falling back to existing values
            let firstName = newData.firstName;
            let lastName = newData.lastName;
            if (!firstName || !lastName) {
                const nameParts = (oldData.name || '').trim().split(' ');
                if (!firstName) firstName = nameParts[0] || '';
                if (!lastName) lastName = nameParts.slice(1).join(' ') || '';
            }
            const avatarUrl = newData.avatarUrl ?? oldData.avatarUrl;
            const birthDate = newData.birthDate ?? oldData.birthDate;

            // Update in Clerk
            await clerkClient.users.updateUser(userId, {
                firstName,
                lastName
            });

            // Update in db
            return await Prisma.user.update({
                where: { id: userId },
                data: {
                    name: `${firstName} ${lastName}`.trim(),
                    birthDate,
                    avatarUrl
                }
            });
        } catch (err) {
            // If Clerk update succeeded but DB update failed, revert Clerk update
            if (originalClerkUser) {
                try {
                    await clerkClient.users.updateUser(userId, {
                        firstName: originalClerkUser.firstName,
                        lastName: originalClerkUser.lastName
                    });
                } catch (rollbackErr) {
                    // Log rollback failure for observability
                    logger.error('Failed to rollback Clerk user update after DB failure', {
                        userId,
                        rollbackErr,
                    });
                }
            }

            throw new ApiError('Failed to update user profile', 500, 'fail', true, AppErrorCode.DATABASE_ERROR);
        }
    }

    /**
     * Logs out the current user by revoking their Clerk session.
     * Logs both successful and failed attempts for observability and security.
     * Throws ApiError if no active session is found or if revocation fails.
     * @param req - The Express request object containing the Clerk session.
     * @returns The result of the Clerk session revocation API.
     */
    static async logOut(req: Request) {
        try {
            const auth = getAuth(req);

            if (!auth.sessionId) {
                logger.warn(`Logout failed: No active session found. IP: ${req.ip}`);
                throw new ApiError("No active session found", 401, 'unauthorized', true, AppErrorCode.UNAUTHORIZED);
            }

            const result = await clerkClient.sessions.revokeSession(auth.sessionId);
            logger.info(`User logged out. Session revoked: ${auth.sessionId}, IP: ${req.ip}`);
            return result;
        } catch (err) {
            logger.error(`Error during logout: ${err}`);
            if (err instanceof ApiError) throw err;
            throw new ApiError('Failed to log out', 500, 'fail', true);
        }
    }




}