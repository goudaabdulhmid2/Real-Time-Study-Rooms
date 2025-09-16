import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from 'zod';
import { UnauthorizedError } from "express-oauth2-jwt-bearer";

import ApiError from "../utils/ApiError";
import {
    PrismaErrorCode,
    AppErrorCode,
    ErrorResponse,
    PrismaErrorConfig,
} from "../types/errorTypes";
import logger from "../config/logger";


// Separate error message formatting
const formatErrorMessage = (errorConfig: PrismaErrorConfig, errorMate: Prisma.PrismaClientKnownRequestError["meta"]
): string => {

    if (typeof errorConfig.message === 'function') {
        const field =
            (errorMate?.target as string[] | undefined)?.[0] || "unknown field";
        return errorConfig.message(field);
    }
    return errorConfig.message;

}

// Common error response formatter
const formatErrorResponse = (err: ApiError, includeDetails: boolean = false): ErrorResponse => {
    const response: ErrorResponse = {
        status: err.status,
        message: err.message,
        timestamp: err.timestamp || new Date(),
        errorCode: err.errorCode,
    };

    if (includeDetails) {
        response.details = err.details;
        response.stack = err.stack;
        response.error = err;
    }

    return response;
}


const prismaErrorMap = new Map([
    [
        PrismaErrorCode.NOT_FOUND,
        {
            message: "Record not found",
            statusCode: 404,
            errorCode: AppErrorCode.RECORD_NOT_FOUND,
        },
    ],
    [
        PrismaErrorCode.UNIQUE_CONSTRAINT,
        {
            message: (field: string) => `Duplicate entry for ${field}`,
            statusCode: 400,
            errorCode: AppErrorCode.DUPLICATE_ENTRY,
        },
    ],
    [
        PrismaErrorCode.FOREIGN_KEY,
        {
            message: (field: string) => `Invalid foreign key for ${field}`,
            statusCode: 400,
            errorCode: AppErrorCode.FOREIGN_KEY_ERROR,
        },
    ],
    [
        PrismaErrorCode.INVALID_VALUE,
        {
            message: (field: string) => `Invalid value for ${field}`,
            statusCode: 400,
            errorCode: AppErrorCode.INVALID_VALUE,
        },
    ],
    [
        PrismaErrorCode.VALUE_TOO_LONG,
        {
            message: (field: string) => `Value too long for ${field}`,
            statusCode: 400,
            errorCode: AppErrorCode.VALUE_TOO_LONG,
        },
    ],
    [
        PrismaErrorCode.VALUE_TOO_SHORT,
        {
            message: (field: string) => `Value too short for ${field}`,
            statusCode: 400,
            errorCode: AppErrorCode.VALUE_TOO_SHORT,
        },
    ],
    [
        PrismaErrorCode.INVALID_DATA_TYPE,
        {
            message: (field: string) => `Invalid data type for ${field}`,
            statusCode: 400,
            errorCode: AppErrorCode.INVALID_DATA_TYPE,
        },
    ],
]);

const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError): ApiError => {
    const errorConfig = prismaErrorMap.get(err.code as PrismaErrorCode);

    if (!errorConfig) {
        return new ApiError(
            "Database error",
            500,
            "error",
            false,
            AppErrorCode.DATABASE_ERROR
        );
    }

    const message: string = formatErrorMessage(errorConfig, err.meta);

    return new ApiError(
        message,
        errorConfig.statusCode,
        "fail",
        true,
        errorConfig.errorCode
    )

}

const handleValidationError = (err: ZodError): ApiError => {
    const firstIssue = err.issues[0];
    const message = firstIssue ? `${firstIssue.message} at ${firstIssue.path.join(".")}`
        : "Validation error";

    return new ApiError(
        message,
        400,
        "fail",
        true,
        AppErrorCode.VALIDATION_ERROR,
        { errors: err.issues }
    );
}

const handleUnauthorizedError = (err: UnauthorizedError): ApiError => {
    return new ApiError(
        err.message || "Unauthorized access.",
        401,
        "fail",
        true,
        AppErrorCode.UNAUTHORIZED
    );
}

const handleNonApiError = (err: Error): ApiError => {

    // Handel Prisma-specific errors 
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return handlePrismaError(err);
    }

    if (err instanceof ZodError) {
        return handleValidationError(err);
    }

    if (err instanceof UnauthorizedError) {
        return handleUnauthorizedError(err);
    }

    return new ApiError(
        err.message || "Something went wrong.",
        500,
        "error",
        false,
        AppErrorCode.DATABASE_ERROR
    );

}

const sendErrorDev = (err: ApiError, res: Response) => {
    logger.error("Error (DEV) ", err);

    res.status(err.statusCode).json(formatErrorResponse(err, true));
}

const sendErrorProd = (err: ApiError, res: Response) => {
    if (err.isOperational) {
        res.status(err.statusCode).json(formatErrorResponse(err));
    } else {
        res.status(500).json({
            status: "error",
            message: "Something went wrong",
            timestamp: err.timestamp || new Date(),
            errorCode: err.errorCode || AppErrorCode.DATABASE_ERROR,
        });
    }
}

export default (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
    const apiError = err instanceof ApiError ? err : handleNonApiError(err);

    if (process.env.NODE_ENV === "development") {
        sendErrorDev(apiError, res);
    } else {
        sendErrorProd(apiError, res);
    }
}