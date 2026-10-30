import type {
  NextFunction,
  Request,
  Response,
} from 'express';

/**
 * Prevents authentication session reads from using
 * cached representations or Express conditional GET shortcuts.
 */
export function authMeNoStoreMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  // Tell browsers and intermediary caches not to store this response.
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'GET' || request.method === 'HEAD') {
    // Prevent Express from returning 304 based on ETag.
    delete request.headers['if-none-match'];

    // Prevent Express from returning 304 based on modification date.
    delete request.headers['if-modified-since'];
  }

  // Continue to the authentication guard and controller.
  next();
}