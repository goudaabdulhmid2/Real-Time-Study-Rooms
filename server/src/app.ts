import express, { Application, Request, Response, NextFunction } from "express";


import config from "./config/config";
import errorHandler from "./middleware/errorHandler";
import ApiError from "./utils/ApiError";
import requestLogger from "./middleware/requestLogger";


const app: Application = config.getApp();

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }))


app.use(requestLogger);



app.all("*", (req: Request, res: Response, next: NextFunction) => {
    return next(
        new ApiError(`Can't find this route ${req.originalUrl}`, 400, "fail", true)
    )
})

// Global error handling middleware
app.use(errorHandler);