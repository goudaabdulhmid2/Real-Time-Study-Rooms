import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { Request, Response } from 'express';
import { Prisma } from '../../../generated/prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(
    GlobalExceptionFilter.name,
  );

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const result = this.normalizeException(exception);

    if (result.statusCode >= 500) {
      const stack =
        exception instanceof Error
          ? exception.stack
          : String(exception);

      this.logger.error(
        'Unhandled exception',
        stack,
      );
    }

    response.status(result.statusCode).json({
      success: false,
      statusCode: result.statusCode,
      message: result.message,
      errors: result.errors,
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    message: string;
    errors: unknown[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return {
          statusCode,
          message: body,
          errors: [],
        };
      }

      if (typeof body === 'object' && body !== null) {
        const payload = body as {
          message?: string | string[];
          errors?: unknown[];
        };

        const errors = payload.errors ?? [];

        const message = Array.isArray(payload.message)
          ? 'Validation failed'
          : payload.message ?? exception.message;

        return {
          statusCode,
          message,
          errors: [
            ...errors,
            ...(Array.isArray(payload.message)
              ? payload.message.map((item) => ({
                  message: item,
                }))
              : []),
          ],
        };
      }

      return {
        statusCode,
        message: exception.message,
        errors: [],
      };
    }

    if (
      exception instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      switch (exception.code) {
        case 'P2002':
          return {
            statusCode: HttpStatus.CONFLICT,
            message: 'A resource with these details already exists.',
            errors: [],
          };

        case 'P2003':
          return {
            statusCode: HttpStatus.CONFLICT,
            message: 'The operation conflicts with related records.',
            errors: [],
          };

        case 'P2025':
          return {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'The requested resource was not found.',
            errors: [],
          };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: [],
    };
  }
}