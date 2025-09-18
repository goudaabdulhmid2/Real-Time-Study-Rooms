import catchAsync from 'express-async-handler';
import { Request, Response, NextFunction } from "express";

import { getAuth } from '../config/clerk';
import ApiError from '../utils/ApiError';
import Prisma from '../config/db';



export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
        return next(new ApiError('Unauthorized', 401, 'unauthorized'));
    }

    let user = await Prisma.user.findUnique({
        where: { clerkUserId }
    });

    // If user not found in DB, create a new user record (sync with Clerk)
    if (!user) {
        // Optionally fetch more user info from Clerk API here
        const name = auth.sessionClaims?.first_name + ' ' + auth.sessionClaims?.last_name
        user = await Prisma.user.create({
            data: {
                clerkUserId,
                name,
                email: typeof auth.sessionClaims?.email === 'string' ? auth.sessionClaims.email : undefined,
                role: 'user',
                avatarUrl: typeof auth.sessionClaims?.image === 'string' ? auth.sessionClaims.image : undefined
            }
        });
    }

    req.user = user;
    next();
});