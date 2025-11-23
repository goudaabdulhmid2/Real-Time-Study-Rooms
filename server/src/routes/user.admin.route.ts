import { Router, Request, Response, NextFunction } from "express";
import { clerkClient } from '@clerk/clerk-sdk-node';
import catchAsync from 'express-async-handler';


import { restrictTo, protect } from '../middleware/auth';




const router = Router();


router.get('/', catchAsync(async (req: Request, res: Response, next: NextFunction) => {

    const data = await clerkClient.users.getUserList();

    res.status(200).json({
        status: "success",
        message: "users data",
        data: {
            data
        },
    });
}));


export default router;